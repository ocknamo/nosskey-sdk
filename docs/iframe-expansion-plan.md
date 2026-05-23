# Nosskey iframe 機能拡充計画

## Context

`nosskey-iframe` パッケージ（v0.0.1）は NIP-07 の `getPublicKey` と `signEvent` のみを実装している。
本ドキュメントでは、NIP-07 仕様の完全対応・UX/セキュリティ改善・接続堅牢化・フレームワーク統合を段階的に実現するロードマップを定義する。

関連ドキュメント:
- `docs/iframe-plan.md` — 初期 iframe 実装計画（実装済み）
- `docs/todo.md` — 全体 TODO リスト

---

## 現状サマリー

| 機能 | 状態 |
|------|------|
| `getPublicKey()` | ✅ 実装済み |
| `signEvent(event)` | ✅ 実装済み（同意ダイアログあり） |
| `nosskey:visibility` | ✅ 実装済み（Storage Access API 対応） |
| `nosskey:ready` | ✅ 実装済み |
| `getRelays()` | ✅ 実装済み（同意不要・iframe アプリで保管） |
| `nip44.encrypt / decrypt` | ✅ 実装済み（同意ダイアログあり） |
| `nip04.encrypt / decrypt` | ✅ 実装済み（同意ダイアログあり） |
| オリジン別の許可記憶 | ✅ 実装済み |
| メソッド別の同意ポリシー | ✅ 実装済み |
| ヘルスチェック / 再接続 | ❌ 未実装 |

---

## 優先度一覧

| Phase | 内容 | 優先度 | 工数感 |
|-------|------|--------|--------|
| 1-A | `getRelays()` | 高 | S |
| 1-B | `nip44.encrypt/decrypt` | 高 | M |
| 1-C | `nip04.encrypt/decrypt` | 高 | S |
| 2-A | オリジン別許可記憶 | 中 | S |
| 2-B | メソッド別同意ポリシー | 中 | M |
| 3-A | ping/pong ヘルスチェック | 低〜中 | S |
| 3-B | 自動再接続 | 低〜中 | M |
| 3-C | `nosskey:error` 通知 | 低 | S |
| 4-A | マルチキー切り替え | 低 | M |
| 5-A | Safari fallback | 低（将来） | L |
| 6-A | ダイアログ表示内容整理 | 中 | S |
| 6-B | スタイル整理（CSS variables化） | 低〜中 | S |
| 6-C | テーマ・言語を親から渡す | 中 | S |
| 6-D | 設定ページへのリンク遷移 | 中 | S |
| 7-A | Web Components (`nosskey-elements`) | 低 | L |

---

## Phase 1: NIP-07 完全対応

**目的**: 主要 Nostr クライアント（Snort, Iris, Nostrium 等）が要求する全 NIP-07 メソッドを揃える。

### 1-A: `getRelays()` の追加（✅ 実装済み）

**概要**: ユーザーの優先リレーリストを返す。ユーザー同意不要の読み取り専用操作。

**データ形式** (NIP-07 仕様準拠):
```typescript
type RelayMap = Record<string, { read: boolean; write: boolean }>;
```

**設計方針**: SDK には実装しない。リレー設定は「アプリのユーザー設定」であり SDK の責務外（`docs/todo.md` でも「リレーへのパブリッシュは SDK 責務外」と明記）。`onConsent` と同パターンで `NosskeyIframeHost` に `onGetRelays` コールバックを追加し、iframe を提供するアプリ側（svelte-app）が localStorage で保管する。書き込み（`setRelays`）はプロトコルに載せず、iframe 内アプリの UI が直接 localStorage を編集する（NIP-07 標準にも `setRelays` は無い）。

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `packages/nosskey-iframe/src/protocol.ts` | `NosskeyMethod` に `'getRelays'` 追加、`isSupportedMethod` 更新 |
| `packages/nosskey-iframe/src/host.ts` | `NosskeyIframeHostOptions` に `onGetRelays` コールバック追加。`#dispatch()` に `getRelays` ケース追加（同意不要、未指定時は `{}` を返す） |
| `packages/nosskey-iframe/src/client.ts` | `getRelays(): Promise<RelayMap>` 追加 |
| `examples/svelte-app/src/services/relays-store.ts` | localStorage の load/save ヘルパー（新規） |
| `examples/svelte-app/src/iframe-mode.ts` | Host 生成時に `onGetRelays: async () => loadRelays()` を渡す |
| `examples/svelte-app/src/components/settings/RelaySettings.svelte` | リレー設定 UI（追加・削除・read/write フラグ切り替え、新規） |
| `examples/svelte-app/src/components/screens/SettingsScreen.svelte` | `<RelaySettings />` 挿入 |
| `examples/svelte-app/src/i18n/translations.ts` | `settings.relays.*` 翻訳追加 |

**テスト追加:**
- `packages/nosskey-iframe/src/host.spec.ts` — `getRelays` リクエストが `onGetRelays` を呼ぶこと、未指定時に `{}` を返すこと
- `packages/nosskey-iframe/src/client.spec.ts` — `getRelays` レスポンス受信

---

### 1-B: `nip44.encrypt / decrypt` の追加（✅ 実装済み）

**概要**: NIP-44 (secp256k1 ECDH + XChaCha20-Poly1305) による DM 暗号化/復号。
`signEvent` と同様に同意ダイアログを表示する。

**技術的前提**:
- `NosskeyManager.exportNostrKey()` で秘密鍵（hex）を取得可能
- `@noble/secp256k1` で ECDH 共有秘密を計算
- `@noble/ciphers` の XChaCha20-Poly1305 で暗号化
- または `@rx-nostr/crypto` の NIP-44 実装を利用（依存に含まれる場合）

**プロトコル拡張:**
```typescript
// protocol.ts
export type NosskeyMethod =
  | 'getPublicKey'
  | 'signEvent'
  | 'getRelays'
  | 'nip44_encrypt'
  | 'nip44_decrypt';

export interface NosskeyRequestParams {
  event?: NostrEvent;
  pubkey?: string;      // 相手の公開鍵 (hex)
  plaintext?: string;   // 平文 (encrypt 用)
  ciphertext?: string;  // 暗号文 (decrypt 用)
}
```

**同意リクエスト拡張:**
```typescript
// host.ts の ConsentRequest
export interface ConsentRequest {
  origin: string;
  method: NosskeyMethod;
  event?: NostrEvent;
  pubkey?: string;    // nip44/nip04 の相手公開鍵
  plaintext?: string; // encrypt 時のみ（decrypt 時は表示しない）
}
```

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `packages/nosskey-sdk/src/types.ts` | `NosskeyManagerLike` に `nip44Encrypt` / `nip44Decrypt` 追加 |
| `packages/nosskey-sdk/src/nosskey.ts` | 実装。内部で `exportNostrKey()` → ECDH → XChaCha20 |
| `packages/nosskey-iframe/src/protocol.ts` | メソッド・パラメータ型を拡張 |
| `packages/nosskey-iframe/src/host.ts` | dispatch ケース追加、`ConsentRequest` 拡張 |
| `packages/nosskey-iframe/src/client.ts` | `nip44: { encrypt(pubkey, plaintext), decrypt(pubkey, ciphertext) }` 追加 |
| `examples/svelte-app/src/components/ConsentDialog.svelte` | nip44 用表示（相手 pubkey 短縮・平文プレビュー） |
| `examples/svelte-app/src/iframe-mode.ts` | `onConsent` の method 分岐を更新 |

**テスト追加:**
- `packages/nosskey-sdk/src/nosskey.spec.ts` — encrypt/decrypt ラウンドトリップ
- `packages/nosskey-iframe/src/host.spec.ts` — 同意あり/なしの暗号化フロー
- `packages/nosskey-iframe/src/client.spec.ts` — `nip44` ネームスペース

---

### 1-C: `nip04.encrypt / decrypt` の追加（✅ 実装済み）

**概要**: NIP-04 (secp256k1 ECDH + AES-256-CBC) による旧式 DM 暗号化。レガシー互換のため必要。

**技術的前提**:
- 共有秘密の導出は `secp256k1.getSharedSecret()` + SHA-256
- 暗号化は Web Crypto API (`AES-CBC`)

**変更ファイル**: 1-B と同じファイル群に `nip04_encrypt` / `nip04_decrypt` を追加（実装のみ異なる）。

**Phase 1 完了の定義**: `window.nostr` の全 NIP-07 メソッドが iframe 経由で動作し、既存テストと同等のカバレッジが追加されていること。

---

## Phase 2: UX・セキュリティ改善

**目的**: ユーザーの操作負荷を下げ、オリジン別の信頼管理を可能にする。

### 2-A: オリジン別の許可記憶（✅ 実装済み）

**概要**: ConsentDialog に「このサイトを常に許可」チェックボックスを追加。承認済みオリジンを localStorage に保存し、以後の同意ダイアログをスキップする。

**ストレージ設計:**
```typescript
// localStorage キー: 'nosskey_trusted_origins_v2'
// origin ごとに、ダイアログを省略するポリシーキーを methods に保持する
type TrustedOriginEntry = {
  origin: string;
  methods: ('signEvent' | 'nip44' | 'nip04')[];
};
type TrustedOrigins = TrustedOriginEntry[];
```

**フロー:**
1. `onConsent` 呼び出し前に `trustedOrigins` を参照
2. origin が含まれていれば即 `true` を返す（ダイアログ表示なし）
3. ダイアログで「常に許可」チェック付きで承認 → `trustedOrigins` に追加して保存

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `examples/svelte-app/src/components/ConsentDialog.svelte` | 「このサイトを常に許可」チェックボックス追加 |
| `examples/svelte-app/src/iframe-mode.ts` | 事前承認チェックロジック追加 |
| `examples/svelte-app/src/components/screens/SettingsScreen.svelte` | 許可済みオリジン一覧表示と削除 UI |

---

### 2-B: メソッド別の同意ポリシー設定（✅ 実装済み）

**概要**: `signEvent` / `nip44` / `nip04` それぞれについて、ユーザーが「毎回確認 / 常に許可 / 拒否」を設定できるようにする。

**ストレージ設計:**
```typescript
// localStorage キー: 'nosskey_consent_policy'
type ConsentPolicy = {
  signEvent: 'ask' | 'always' | 'deny';
  nip44: 'ask' | 'always' | 'deny';
  nip04: 'ask' | 'always' | 'deny';
};
// デフォルト: すべて 'ask'
```

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `examples/svelte-app/src/components/screens/SettingsScreen.svelte` | ポリシー設定 UI（ラジオボタン 3 択） |
| `examples/svelte-app/src/iframe-mode.ts` | `onConsent` 内でポリシー評価 |

---

## Phase 3: 接続堅牢化

**目的**: iframe がクラッシュ・タイムアウトした際の回復を自動化する。

### 3-A: ヘルスチェック（ping/pong）

**新規プロトコルメッセージ:**
```typescript
interface NosskeyPing { type: 'nosskey:ping'; id: string; }
interface NosskeyPong { type: 'nosskey:pong'; id: string; }
```

**Client の動作:**
- `ready()` 後、設定間隔（デフォルト 30 秒）で ping を送信
- 5 秒以内に pong が来なければ接続断イベントを発行

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `packages/nosskey-iframe/src/protocol.ts` | `NosskeyPing` / `NosskeyPong` 型と型ガード追加 |
| `packages/nosskey-iframe/src/host.ts` | ping 受信 → pong 送信 |
| `packages/nosskey-iframe/src/client.ts` | `pingInterval` オプション追加、タイムアウト検知 |

---

### 3-B: 自動再接続

**概要**: Client が接続断を検知したら iframe を再マウントし `ready()` を再待機する。

**設定オプション:**
```typescript
interface NosskeyIframeClientOptions {
  // ... 既存オプション
  reconnect?: {
    enabled: boolean;     // デフォルト false
    maxRetries: number;   // デフォルト 3
    backoffMs: number;    // デフォルト 1000（指数バックオフ）
  };
}
```

**変更ファイル:**
- `packages/nosskey-iframe/src/client.ts` — 再接続ロジック追加
- `packages/nosskey-iframe/src/client.spec.ts` — 再接続テスト追加

---

### 3-C: `nosskey:error` プロアクティブ通知

**概要**: iframe 側で予期しないエラーが発生した際、親へ非同期通知するメッセージを追加。

```typescript
interface NosskeyErrorNotification {
  type: 'nosskey:error';
  code: NosskeyErrorCode;
  message: string;
}
```

**Client の対応:**
```typescript
const client = new NosskeyIframeClient({
  iframeUrl: '...',
  onError?: (code, message) => void;
});
```

---

## Phase 4: マルチキー対応

**目的**: 複数パスキーを持つユーザーが iframe 経由でキーを切り替えられるようにする。

### 4-A: `switchKey(credentialId)` メソッド

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `packages/nosskey-iframe/src/protocol.ts` | `'switchKey'` メソッド追加、params に `credentialId: string` |
| `packages/nosskey-iframe/src/host.ts` | `manager.setCurrentKeyInfo()` を呼ぶハンドラ |
| `packages/nosskey-iframe/src/client.ts` | `switchKey(credentialId: string): Promise<void>` 追加 |
| `examples/svelte-app/src/components/screens/IframeHostScreen.svelte` | switchKey リクエスト受信時のキー選択 UI |

---

## Phase 5: ブラウザ対応拡大（将来）

### 5-A: Safari / iOS 向け Cookie ストレージブリッジ

**状態**: 実装済み。

**背景**: WebKit (Safari / iOS) はクロスオリジン iframe の `localStorage` を partition し、`document.requestStorageAccess()` 後も localStorage は partition されたまま（unpartition されるのは cookie のみ）。Chromium の `requestStorageAccess({ all: true })` 相当の API は無く、`handle.localStorage` も存在しない。このため、別タブでパスキー登録した結果が iframe からは見えず `NO_KEY` になる問題があった。

**方針**: client 側 API は変更せず、svelte-app 内部の仕組みだけで Safari/iOS を吸収する。秘密鍵を含まない `NostrKeyInfo`（`{credentialId, pubkey, salt, username?}`）を first-party cookie 経由で iframe に橋渡しする。

**メカニズム**:

1. **`CookieStorage` + `MultiStorage`** — `examples/svelte-app/src/services/cookie-storage.ts` と `multi-storage.ts` で `Storage` インターフェース互換のデュアルライト機構を実装。スタンドアロンタブでは `localStorage` を primary、`CookieStorage` をミラーとし、`setCurrentKeyInfo` のたびに first-party cookie へ自動ミラーする。
2. **`applyStorageGrant` の WebKit 経路** — SAA grant の `handle` が null かつ WebKit (iOS Safari / iOS Chrome (CriOS) / iOS Firefox (FxiOS) など) 判定なら manager の storage を `CookieStorage` に切り替え、cookie 経由で `NostrKeyInfo` を rehydrate できるようにする。
3. **`visibilitychange` / `pageshow` 再判定** — iframe が再可視化されたタイミングで `detectInitialState()` を再実行。別タブで登録を終えて戻ってきた瞬間に silent SAA grant が解決し、cookie に書き込まれた `NostrKeyInfo` が iframe 側で見えるようになる。Chromium / Firefox の戻り検出も同じ仕組みで自然に動く。

**制約**:
- Cookie 属性は `Path=/; SameSite=None; Secure; Max-Age=31536000`。`SameSite=None` には `Secure` が必須で、これは HTTPS 必須を意味する。`http://localhost` 開発時は cookie パスがサイレントに無効化されるが、`MultiStorage` が mirror 失敗を隔離しているため primary (localStorage) 動作には影響しない。同一 origin (`http://localhost`) のみで動作確認する場合は partition 問題自体が発生しないので問題にならない。
- `NostrKeyInfo` は秘密鍵を含まないため cookie 経由で渡しても安全（実際の秘密鍵導出は WebAuthn PRF を都度実行）。
- ユーザーが「ストレージアクセス許可」を出す前に「セットアップを開く」を押し、登録後に戻ってきた場合、まずは「許可」ボタンを押す必要がある（SAA grant 前は cookie が partitioned のため、iframe から first-party cookie が見えない）。i18n `partitionedWarning` でこのケースを案内している。
- デスクトップで親タブと新ウィンドウを **横並びに同時表示** している場合、親タブの `document.visibilityState` は `visible` のまま変化しないため `visibilitychange` が発火せず、戻り検出が走らない。ユーザーが一度別タブに切り替えるか、親タブをリロードすれば検出される。モバイル Safari / iOS では別タブ起動でタブが切り替わるため通常問題にならない。`focus` イベントによる検出は debounce が必要なため、本フェーズではスコープ外。

**実装ファイル**:
- `examples/svelte-app/src/services/cookie-storage.ts` (新規)
- `examples/svelte-app/src/services/multi-storage.ts` (新規)
- `examples/svelte-app/src/services/nosskey-manager.service.ts` — MultiStorage 注入、`getCookieStorage()` export
- `examples/svelte-app/src/components/screens/IframeHostScreen.svelte` — visibilitychange/pageshow 再判定、WebKit 時の CookieStorage 切替
- `examples/parent-sample/src/main.ts` — NO_KEY ヒント文更新

---

## Phase 6: ダイアログ UX 改善

**目的**: 同意ダイアログの視認性向上と、親アプリとの見た目の統一。

### 6-A: 表示内容の整理

**概要**: 現在の ConsentDialog は signEvent のイベント JSON をそのまま表示しており読みにくい。

**改善内容:**
- kind 番号 → 人間可読ラベル変換（例: `kind:1` → "テキストノート"、`kind:3` → "フォローリスト"）
- `content` 冒頭 100 文字のプレビュー表示
- JSON 詳細は `<details>` / `<summary>` で折りたたみ
- nip44/nip04 時は相手 pubkey を短縮表示（先頭 8 文字 + `...` + 末尾 8 文字）

**変更ファイル:**
- `examples/svelte-app/src/components/ConsentDialog.svelte`

---

### 6-B: スタイル整理

**概要**: CSS を CSS Variables ベースに整理し、テーマ切り替えと保守性を向上させる。

**変更ファイル:**
- `examples/svelte-app/src/components/ConsentDialog.svelte` — CSS variables 化
- `examples/svelte-app/src/app.css` — 共通 CSS variables の整理

---

### 6-C: テーマ・言語を親から渡す

**概要**: 親アプリのテーマや言語を iframe に伝え、ダイアログをアプリと統一感のある表示にする。

**方式**: iframe URL のクエリパラメータで渡す。

```typescript
// Client 側: iframeUrl に自動付与
const client = new NosskeyIframeClient({
  iframeUrl: 'https://nosskey.app/#/iframe',
  theme: 'dark',  // 'dark' | 'light' | 'auto'（デフォルト 'auto'）
  lang: 'ja',     // 'ja' | 'en'（デフォルト ブラウザ言語）
});
// → iframe src: 'https://nosskey.app/#/iframe?theme=dark&lang=ja'
```

**Svelte アプリ側**: 起動時に URL パラメータを読み取り、`ThemeSettings` / i18n の初期値として使用。

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `packages/nosskey-iframe/src/client.ts` | `theme` / `lang` オプション追加、URL 生成時に付与 |
| `examples/svelte-app/src/App.svelte` | URL パラメータ読み取りと設定への反映 |
| `examples/svelte-app/src/services/theme-settings.svelte` | URL パラメータ優先の初期化ロジック |

---

### 6-D: 設定ページへのリンク遷移追加

**概要**: NO_KEY エラー発生時に、ユーザーが設定ページへ直接移動できる導線を追加する。
現在は親アプリのコンソールログにヒントが出るだけで、ユーザーへの UI 上の誘導がない。

**新規メッセージ（任意）:**
```typescript
interface NosskeySetupRequired {
  type: 'nosskey:setup_required';
  settingsUrl: string; // 'https://nosskey.app/#/settings'
}
```

**Client 側オプション:**
```typescript
interface NosskeyIframeClientOptions {
  onSetupRequired?: (settingsUrl: string) => void;
  // デフォルト実装: window.open(settingsUrl, '_blank')
}
```

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `examples/svelte-app/src/components/screens/IframeHostScreen.svelte` | NO_KEY 状態で「Nosskey を設定する」ボタン表示 |
| `packages/nosskey-iframe/src/protocol.ts` | `NosskeySetupRequired` 型追加 |
| `packages/nosskey-iframe/src/host.ts` | NO_KEY エラー時に `nosskey:setup_required` を送信 |
| `packages/nosskey-iframe/src/client.ts` | `onSetupRequired` コールバック追加 |
| `examples/parent-sample/src/main.ts` | `onSetupRequired` の参照実装 |

---

## Phase 7: Web Components による導入しやすさ改善

**目的**: React / Vue / Svelte どこでも 1 行で Nosskey 接続ボタンを追加できるようにする。

### 7-A: `nosskey-elements` パッケージの追加

**提供する要素:**
```html
<nosskey-button
  iframe-url="https://nosskey.app/#/iframe"
  label="Sign with Nosskey"
  theme="auto"
  lang="ja"
></nosskey-button>
```

**カスタムイベント:**

| イベント | detail の型 | タイミング |
|----------|------------|-----------|
| `nosskey-connected` | `{ pubkey: string }` | 接続完了 |
| `nosskey-signed` | `{ event: NostrEvent }` | 署名完了 |
| `nosskey-error` | `{ code: string; message: string }` | エラー発生 |

**使用例:**
```javascript
const btn = document.querySelector('nosskey-button');
btn.addEventListener('nosskey-connected', (e) => {
  console.log('pubkey:', e.detail.pubkey);
});
```

**新規パッケージ構成:**
```
packages/nosskey-elements/
├── src/
│   ├── nosskey-button.ts   # HTMLElement 継承カスタム要素
│   └── index.ts            # customElements.define() + 型エクスポート
├── package.json            # 依存: nosskey-iframe
├── tsconfig.json
└── tsup.config.ts          # ESM + CJS + iife (CDN 用 bundle)
```

**配布:**
- npm: `nosskey-elements`
- CDN: `dist/nosskey-elements.min.js`（`<script src>` 1 行で利用可能）

---

## 検証方法

```sh
# 単体テスト
npm test -w packages/nosskey-sdk
npm test -w packages/nosskey-iframe

# ビルド
npm run build

# Lint / フォーマット
npm run format:check
npm run build
npm run test:coverage
npm run check -w svelte-app

# E2E（手動）
npm run dev -w examples/svelte-app        # ポート 5173: iframe ホスト
npm run dev -w examples/parent-sample     # ポート 5174: 親ページサンプル
# parent-sample の UI から各 NIP-07 メソッドを実行して動作確認
```

---

## 重要ファイル一覧

| ファイル | 役割 |
|----------|------|
| `packages/nosskey-iframe/src/protocol.ts` | メッセージ型定義（拡張の起点） |
| `packages/nosskey-iframe/src/host.ts` | iframe 側ディスパッチャ |
| `packages/nosskey-iframe/src/client.ts` | 親ページ側 API |
| `packages/nosskey-sdk/src/nosskey.ts` | コア SDK（秘密鍵アクセス可・NIP-04/44 実装先） |
| `packages/nosskey-sdk/src/types.ts` | `NosskeyManagerLike` インタフェース（拡張の起点） |
| `examples/svelte-app/src/iframe-mode.ts` | Host 初期化・同意コールバック |
| `examples/svelte-app/src/components/ConsentDialog.svelte` | 同意ダイアログ UI |
| `examples/svelte-app/src/components/screens/IframeHostScreen.svelte` | Storage Access API 対応・設定ページ誘導 |
| `examples/svelte-app/src/components/screens/SettingsScreen.svelte` | リレー設定・同意ポリシー設定 UI 追加先 |
