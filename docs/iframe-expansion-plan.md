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
| `getRelays()` | ❌ 未実装 |
| `nip44.encrypt / decrypt` | ❌ 未実装 |
| `nip04.encrypt / decrypt` | ❌ 未実装 |
| オリジン別の許可記憶 | ❌ 未実装 |
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

### 1-A: `getRelays()` の追加

**概要**: ユーザーの優先リレーリストを返す。ユーザー同意不要の読み取り専用操作。

**データ形式** (NIP-07 仕様準拠):
```typescript
type RelayMap = Record<string, { read: boolean; write: boolean }>;
```

**変更ファイル:**

| ファイル | 変更内容 |
|----------|---------|
| `packages/nosskey-sdk/src/types.ts` | `NosskeyManagerLike` に `getRelays(): Promise<RelayMap>` / `setRelays(relays: RelayMap): void` 追加 |
| `packages/nosskey-sdk/src/nosskey.ts` | `getRelays()` / `setRelays()` 実装。localStorage に `nosskey_relays` キーで JSON 保存 |
| `packages/nosskey-iframe/src/protocol.ts` | `NosskeyMethod` に `'getRelays'` 追加 |
| `packages/nosskey-iframe/src/host.ts` | `#dispatch()` に `getRelays` ケース追加 |
| `packages/nosskey-iframe/src/client.ts` | `getRelays(): Promise<RelayMap>` 追加 |
| `examples/svelte-app/src/screens/SettingsScreen.svelte` | リレー設定 UI（追加・削除・read/write フラグ切り替え）を追加 |

**テスト追加:**
- `packages/nosskey-sdk/src/nosskey.spec.ts` — `getRelays` / `setRelays` の正常系・空リスト
- `packages/nosskey-iframe/src/host.spec.ts` — `getRelays` リクエスト処理
- `packages/nosskey-iframe/src/client.spec.ts` — `getRelays` レスポンス受信

---

### 1-B: `nip44.encrypt / decrypt` の追加

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

### 1-C: `nip04.encrypt / decrypt` の追加

**概要**: NIP-04 (secp256k1 ECDH + AES-256-CBC) による旧式 DM 暗号化。レガシー互換のため必要。

**技術的前提**:
- 共有秘密の導出は `secp256k1.getSharedSecret()` + SHA-256
- 暗号化は Web Crypto API (`AES-CBC`)
- 既存の `crypto-utils.ts` の AES-GCM とは別実装

**変更ファイル**: 1-B と同じファイル群に `nip04_encrypt` / `nip04_decrypt` を追加（実装のみ異なる）。

**Phase 1 完了の定義**: `window.nostr` の全 NIP-07 メソッドが iframe 経由で動作し、既存テストと同等のカバレッジが追加されていること。

---

## Phase 2: UX・セキュリティ改善

**目的**: ユーザーの操作負荷を下げ、オリジン別の信頼管理を可能にする。

### 2-A: オリジン別の許可記憶

**概要**: ConsentDialog に「このサイトを常に許可」チェックボックスを追加。承認済みオリジンを localStorage に保存し、以後の同意ダイアログをスキップする。

**ストレージ設計:**
```typescript
// localStorage キー: 'nosskey_trusted_origins'
type TrustedOrigins = string[]; // ['https://example.com', ...]
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
| `examples/svelte-app/src/screens/SettingsScreen.svelte` | 許可済みオリジン一覧表示と削除 UI |

---

### 2-B: メソッド別の同意ポリシー設定

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
| `examples/svelte-app/src/screens/SettingsScreen.svelte` | ポリシー設定 UI（ラジオボタン 3 択） |
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
| `examples/svelte-app/src/screens/IframeHostScreen.svelte` | switchKey リクエスト受信時のキー選択 UI |

---

## Phase 5: ブラウザ対応拡大（将来）

### 5-A: Safari 向け `window.open()` フォールバック

**現状**: Safari は iframe 内での WebAuthn が不安定（PRF 拡張のサポートも限定的）。
**方針**: Safari の PRF サポートが安定した段階で対応を検討する。現時点は調査フェーズ。

**設計案:**
```typescript
interface NosskeyIframeClientOptions {
  mode?: 'iframe' | 'popup' | 'auto'; // 'auto' でブラウザ判定
  popupUrl?: string; // ポップアップ URL（デフォルト iframeUrl の #/popup）
}
```

**変更ファイル:**
- `packages/nosskey-iframe/src/client.ts` — ポップアップモード追加
- `examples/svelte-app/src/App.svelte` — `#/popup` ルート対応

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
| `examples/svelte-app/src/screens/IframeHostScreen.svelte` | NO_KEY 状態で「Nosskey を設定する」ボタン表示 |
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
| `examples/svelte-app/src/screens/IframeHostScreen.svelte` | Storage Access API 対応・設定ページ誘導 |
| `examples/svelte-app/src/screens/SettingsScreen.svelte` | リレー設定・同意ポリシー設定 UI 追加先 |
