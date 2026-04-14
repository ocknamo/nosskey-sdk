# Nosskey iframe 対応 計画

## Context

Nosskey SDK は WebAuthn PRF 拡張で Nostr 秘密鍵を生成する。WebAuthn は Origin に束縛されるため、複数 Nostr Web アプリが同じパスキーを共有できない。

**解決策:** Nosskey を iframe 署名プロバイダ化。`nosskey.app` 等を子 iframe として各 Nostr アプリに埋め込み、親アプリが postMessage 経由で NIP-07 互換 API (`getPublicKey`, `signEvent`) を呼ぶ。パスキーは `nosskey.app` Origin に紐づくので、任意のドメインのアプリから同じ鍵で署名可能になる。

関連 TODO: `docs/todo.md:9-10`

---

## スコープ

### やる

- リポジトリを npm workspaces でモノレポ化
- 新規パッケージ `nosskey-iframe` を追加 (Host / Client / Protocol)
- 既存 Svelte アプリを iframe モード運用に改造
- ユニットテスト (protocol / host / client)
- 最小ドキュメント (README 追記)

### やらない

- NIP-46 (Nostr Connect) 実装
- NIP-04 / NIP-44 暗号化 API (Nosskey SDK 本体に未存在)
- 後方互換の通常モード維持 (ユーザー承認済: 「普通 iframe ではないモードはなくてもよい」)
- 独立した iframe 専用サンプル (既存 Svelte アプリ改造で兼ねる)

---

## アーキテクチャ

```
┌───────────────────────────────────┐
│ Parent App (example.com)          │
│   import { NosskeyIframeClient }  │
│   window.nostr = new Client(...)  │
│            ↕ postMessage          │
│   ┌────────────────────────────┐  │
│   │ <iframe src="nosskey.app"> │  │
│   │   NosskeyIframeHost        │  │
│   │     └─ NosskeyManager      │  │
│   │         (WebAuthn+PRF)     │  │
│   └────────────────────────────┘  │
└───────────────────────────────────┘
```

- **Client** (親ページで動作): `window.nostr` 互換オブジェクト。メソッド呼び出しを postMessage 化して iframe へ送信。応答を Promise で解決。
- **Host** (iframe 内で動作): postMessage listener。内部に `NosskeyManager` インスタンスを保持。メソッド実行後に結果を親へ返信。ユーザー確認 UI を iframe 内で表示。
- **Protocol**: JSON-RPC 風メッセージ型定義。`id` / `method` / `params` + `result` / `error`。

パスキー認証は iframe (= `nosskey.app` Origin) 内の WebAuthn 呼び出しで実行される → `nosskey.app` にバインドされた単一パスキーで全アプリから署名可能。

---

## モノレポ構造

```
nosskey-sdk/
├── package.json              # workspaces 定義
├── packages/
│   ├── nosskey-sdk/          # 既存 SDK (現 src/ 等を移動)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── vitest.config.ts
│   └── nosskey-iframe/       # 新規
│       ├── src/
│       │   ├── index.ts
│       │   ├── protocol.ts   # message 型, リクエスト/レスポンス定義
│       │   ├── host.ts       # NosskeyIframeHost
│       │   ├── client.ts     # NosskeyIframeClient
│       │   ├── host.spec.ts
│       │   ├── client.spec.ts
│       │   └── protocol.spec.ts
│       ├── package.json      # nosskey-sdk を依存
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       └── vitest.config.ts
└── examples/
    └── svelte-app/           # iframe モード運用に改造
```

- **ワークスペースツール:** npm workspaces (既存 npm 使用中、追加ツール不要)
- **パッケージ命名:** `nosskey-sdk` (既存維持) + `nosskey-iframe` (新規、unscoped)

---

## Protocol 設計

`packages/nosskey-iframe/src/protocol.ts`

```ts
export type NosskeyMethod = 'getPublicKey' | 'signEvent';

export interface NosskeyRequest {
  type: 'nosskey:request';
  id: string;           // UUID
  method: NosskeyMethod;
  params?: unknown;     // signEvent: NostrEvent
}

export interface NosskeyResponse {
  type: 'nosskey:response';
  id: string;
  result?: unknown;
  error?: { code: string; message: string };
}

export interface NosskeyReady {
  type: 'nosskey:ready';  // iframe → parent, 初期化完了
}
```

**エラーコード:** `NOT_AUTHORIZED` / `NO_KEY` / `USER_REJECTED` / `UNKNOWN_METHOD` / `INTERNAL`

---

## Host API

`packages/nosskey-iframe/src/host.ts`

```ts
export interface NosskeyIframeHostOptions {
  manager: NosskeyManagerLike;
  allowedOrigins?: string[] | '*';  // デフォルト '*', 本番は明示推奨
  requireUserConsent?: boolean;      // signEvent 毎にユーザー確認 (default true)
  onConsent?: (req: { origin: string; event: NostrEvent }) => Promise<boolean>;
}

export class NosskeyIframeHost {
  constructor(options: NosskeyIframeHostOptions);
  start(): void;   // window.addEventListener('message', ...)
  stop(): void;
}
```

- iframe 起動時に `{ type: 'nosskey:ready' }` を `window.parent.postMessage` で通知
- 親からリクエスト受信時: Origin 検証 → `NosskeyManager` 実行 → 応答
- `signEvent` 時は `onConsent` コールバックでホスト側 UI (Svelte) がユーザー承認取得
- 鍵未設定時: `NO_KEY` エラー → 親は別タブで `nosskey.app` 設定ページに誘導

---

## Client API

`packages/nosskey-iframe/src/client.ts`

```ts
export interface NosskeyIframeClientOptions {
  iframeUrl: string;          // 'https://nosskey.app/iframe'
  container?: HTMLElement;    // 既定: document.body
  timeout?: number;           // 応答タイムアウト (ms), default 60000
}

export class NosskeyIframeClient {
  constructor(options: NosskeyIframeClientOptions);
  ready(): Promise<void>;                             // iframe 'nosskey:ready' 待機
  getPublicKey(): Promise<string>;                    // NIP-07
  signEvent(event: NostrEvent): Promise<NostrEvent>;  // NIP-07
  destroy(): void;                                    // iframe 削除 & listener 解除
}
```

- 内部で `<iframe src="...">` を動的生成 (`display:none` 可、ただし user gesture 必要時は表示切替)
- リクエスト毎に UUID を発行、Promise を map 保持、応答受信時に解決
- タイムアウト超過で reject
- ユーザー承認ダイアログ表示が必要な場合は iframe を可視化 (CSS クラス切替)

### 利用例

```ts
import { NosskeyIframeClient } from 'nosskey-iframe';

const client = new NosskeyIframeClient({
  iframeUrl: 'https://nosskey.app/iframe',
});
await client.ready();
window.nostr = {
  getPublicKey: () => client.getPublicKey(),
  signEvent: (e) => client.signEvent(e),
};
```

---

## Svelte アプリ改造 (`examples/svelte-app/`)

**方針:** iframe モードを既定運用にする。通常モードの Nostr タイムライン等は削除可。

### ルート構成 (URL hash ベース)

| パス | 説明 |
|------|------|
| `#/iframe` | iframe 専用エントリ。`NosskeyIframeHost` を起動。UI は「署名確認ダイアログ」のみ。 |
| `#/settings` | キー管理ページ (単独アクセス用)。既存 `KeyManagementScreen` / `AccountScreen` / `SettingsScreen` を流用。 |
| `#/` | `#/settings` へリダイレクト、または簡易ランディング。 |

### 削除候補

- `TimelineScreen` / `relay.service.ts` / `test-rxnostr.ts` (Nostr リレー機能は SDK スコープ外、iframe モードでも不要)
- ユーザー回答「普通 iframe ではないモードはなくてもよい」に従い、Nostr クライアント的機能は削除

### 追加

- `src/iframe-mode.ts` (エントリ): `NosskeyIframeHost` 初期化、既存 `nosskey-manager.service.ts` と統合
- `src/components/ConsentDialog.svelte`: `signEvent` 時のユーザー承認 UI (イベント内容表示、許可/拒否)
- `App.svelte`: hash routing で iframe / settings モード分岐

### 参考にする既存ファイル

- `examples/svelte-app/src/services/nosskey-manager.service.ts` — シングルトン + RPId 自動判定。そのまま流用
- `examples/svelte-app/src/App.svelte` — ルーティング基盤
- `examples/svelte-app/src/components/` — 既存 UI コンポーネント群

---

## 変更/追加 ファイル一覧

### 新規

```
packages/nosskey-iframe/package.json
packages/nosskey-iframe/tsconfig.json
packages/nosskey-iframe/tsup.config.ts
packages/nosskey-iframe/vitest.config.ts
packages/nosskey-iframe/src/index.ts
packages/nosskey-iframe/src/protocol.ts
packages/nosskey-iframe/src/host.ts
packages/nosskey-iframe/src/client.ts
packages/nosskey-iframe/src/host.spec.ts
packages/nosskey-iframe/src/client.spec.ts
packages/nosskey-iframe/src/protocol.spec.ts
packages/nosskey-iframe/README.md
examples/svelte-app/src/iframe-mode.ts
examples/svelte-app/src/components/ConsentDialog.svelte
```

### 移動 (mv 相当)

```
src/                    → packages/nosskey-sdk/src/
tsconfig.json           → packages/nosskey-sdk/tsconfig.json
tsup.config.ts          → packages/nosskey-sdk/tsup.config.ts
vitest.config.ts        → packages/nosskey-sdk/vitest.config.ts
package.json (SDK設定)  → packages/nosskey-sdk/package.json
```

### 修正

```
package.json (ルート)                           workspaces 宣言、共通 dev スクリプト
biome.json                                      ルートに配置、全パッケージ対象
examples/svelte-app/package.json                依存更新 (workspace 参照 nosskey-sdk, nosskey-iframe)
examples/svelte-app/src/App.svelte              hash routing 再構成
examples/svelte-app/src/main.ts (or 類似)       iframe モード起動処理
README.md                                       iframe 利用方法追記
docs/todo.md                                    該当 TODO 項目にチェック
```

### 削除

```
examples/svelte-app/src/components/TimelineScreen.*  (存在すれば)
examples/svelte-app/src/services/relay.service.ts
examples/svelte-app/src/services/test-rxnostr.ts
```

---

## 既存コード再利用ポイント

| ファイル | 用途 |
|----------|------|
| `src/nosskey.ts` の `NosskeyManager` | iframe Host 内でそのまま使用 |
| `src/types.ts` の `NosskeyManagerLike` | Host オプションの型として参照 |
| `src/types.ts` の `NostrEvent` | Protocol message で共通利用 |
| `examples/svelte-app/src/services/nosskey-manager.service.ts` | RPId 自動判定ロジック流用 |

---

## セキュリティ設計

| 項目 | 方針 |
|------|------|
| Origin 検証 | Host は `allowedOrigins` と受信メッセージの `event.origin` を厳密一致検証 |
| User consent | `signEvent` 毎に iframe 内 UI で承認取得 (`requireUserConsent: true` 既定) |
| Replay 対策 | `id` の UUID 一意性 + 応答後に map から削除 |
| 鍵流出防止 | 秘密鍵は iframe 内のみで保持。親には公開鍵/署名済みイベントしか渡さない |
| XSS 対策 | iframe は `sandbox` 属性考慮 (`allow-scripts allow-same-origin` 最小) |
| 未設定時 UX | `NO_KEY` エラー時、親アプリは `nosskey.app` 設定ページを別タブで開くよう誘導 |

---

## 検証

### 単体テスト

```sh
npm test -w packages/nosskey-iframe
npm test -w packages/nosskey-sdk
```

| ファイル | テスト内容 |
|----------|------------|
| `protocol.spec.ts` | メッセージ型の型検証、エラーコード網羅 |
| `host.spec.ts` | postMessage mock で Origin 検証/許可/拒否、各メソッド実行、NO_KEY 系 |
| `client.spec.ts` | iframe mock、リクエスト → 応答、タイムアウト、エラー伝播 |

### E2E 手動検証

1. `npm run build` モノレポ全体
2. Svelte アプリ起動: `npm run dev -w examples/svelte-app`
3. 親用ダミー HTML (ローカル別ポート) 作成し `<iframe src="localhost:xxxx/#/iframe">` 埋込
4. 親ページから `client.getPublicKey()` / `client.signEvent(...)` 実行
5. 承認ダイアログが iframe 内で出ること、結果が親に返ることを確認
6. `#/settings` 単独アクセスでキー作成/エクスポート動作確認
7. 異 Origin 親からの Origin 不一致時に拒否されることを確認

### ビルド検証

```sh
npm run build -w packages/nosskey-sdk
npm run build -w packages/nosskey-iframe
npm run build -w examples/svelte-app
npx biome check .
```

---

## 段階実装順

1. **モノレポ化** — 既存 SDK 移動、workspaces 設定、既存テスト通過確認
2. **`nosskey-iframe` パッケージ雛形** + `protocol.ts` + テスト
3. **`host.ts` 実装** + テスト
4. **`client.ts` 実装** + テスト
5. **Svelte アプリ改造** — ルーティング、`iframe-mode.ts`、`ConsentDialog`
6. **Svelte アプリ不要機能削除**
7. **README 追記**、`docs/todo.md` 更新
8. **全体ビルド / 手動検証**

> 各段階でコミット
