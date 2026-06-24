# nosskey-iframe

[![npm](https://img.shields.io/npm/v/nosskey-iframe.svg)](https://www.npmjs.com/package/nosskey-iframe)
[![license](https://img.shields.io/npm/l/nosskey-iframe.svg)](./LICENSE)

[NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) 互換の署名 API を iframe 境界越しに提供する `postMessage` ブリッジ。[Nosskey](https://github.com/ocknamo/nosskey-sdk) プロジェクト (パスキー派生 Nostr 鍵) 向けに作られている。

1 つのバンドルに 2 つの役割を同梱:

- **Client** — *親アプリ* で動作し、署名 iframe をマウントして `postMessage` で host と会話する。**`nosskey-sdk` ランタイム依存なし。**
- **Host** — *iframe 内側* (実際に鍵を保持するページ、例: `nosskey.app`) で動作。`NosskeyManager` (from `nosskey-sdk`) をラップし、ユーザー同意付きでリクエストに応答する。

自分の役割に応じて下のセクションを読んでください。

---

## インストール

### Client のみ (一般的なケース — 他者の署名 iframe を埋め込む側)

```sh
npm i nosskey-iframe
```

追加の依存は不要です。`nosskey-sdk` は **optional** な peer dependency として宣言されており、host を実装する場合のみ必要です (下記参照)。

### Host (署名 iframe を運営する側)

```sh
npm i nosskey-iframe nosskey-sdk
```

---

## クイックスタート — Client (親アプリ)

親ページが iframe をマウントし、`window.nostr` 呼び出しを転送します。

```ts
import { NosskeyIframeClient } from 'nosskey-iframe';

const client = new NosskeyIframeClient({
  iframeUrl: 'https://nosskey.app/#/iframe',
  // 任意: theme / lang は URL パラメータで iframe に伝搬される。
  // theme: 'auto',
  // lang:  'auto',
  // 任意: iframe を挿入するコンテナ要素。省略時は document.body。
  // container: document.getElementById('nosskey-mount'),
});

await client.ready();

window.nostr = {
  getPublicKey: () => client.getPublicKey(),
  signEvent:    (event) => client.signEvent(event),
  getRelays:    () => client.getRelays(),
  nip44: {
    encrypt: (peer, plain)  => client.nip44.encrypt(peer, plain),
    decrypt: (peer, cipher) => client.nip44.decrypt(peer, cipher),
  },
  nip04: {
    encrypt: (peer, plain)  => client.nip04.encrypt(peer, plain),
    decrypt: (peer, cipher) => client.nip04.decrypt(peer, cipher),
  },
};
```

`NosskeyIframeClient` は `<iframe>` を
`allow="publickey-credentials-get; publickey-credentials-create"` でマウントします。host ページ側は**対応するレスポンスヘッダ**も返す必要があります:

```
Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*
```

このヘッダがないと Chromium は iframe 内での WebAuthn 実行を拒否します。

詳細な統合手順 (storage partitioning、Storage Access API による復旧、エラーハンドリング、モーダル UX 等) は
[`docs/ja/iframe-integration.ja.md`](../../docs/ja/iframe-integration.ja.md) を参照。
動作可能なデモは [`examples/parent-sample`](../../examples/parent-sample) にあります。

---

## クイックスタート — Host (署名プロバイダ)

パスキー派生鍵を保持するページを運営する場合は、`NosskeyIframeHost` をインスタンス化し `NosskeyManager` を渡します。

```ts
import { NosskeyManager } from 'nosskey-sdk';
import { NosskeyIframeHost, type ConsentRequest } from 'nosskey-iframe';

const manager = new NosskeyManager(/* storage / PRF オプション */);

const host = new NosskeyIframeHost({
  manager,
  // 必須（デフォルトなし）。信頼する親オリジンを列挙するか、オープン埋め込みを
  // 意図的に有効化する場合のみ '*' を渡します（全オリジン許可・起動時に警告ログ）。
  allowedOrigins: ['https://your-parent-app.example'],
  requireUserConsent: true,
  onConsent: async (req: ConsentRequest) => {
    // req.method / req.origin / req.event 等を表示する同意 UI を出し、
    // 承認なら true、拒否なら false を返す。
    return await showConsentDialog(req);
  },
  // 任意: NIP-07 getRelays() の実装。
  onGetRelays: async () => ({
    'wss://relay.example': { read: true, write: true },
  }),
});

host.start();
// 終了処理:
// host.stop();
```

全 7 つの NIP-07 メソッドが `onConsent` で gate されます。`getPublicKey` / `getRelays` に対する同意は、NIP-07 ブラウザ拡張と同じ「オリジン単位の接続承認（ペアリング）」として機能します。これにより、任意の埋め込みサイトがログイン中ユーザーの npub やリレー設定をサイレントに読み取ることを防ぎます。承認済みオリジンは同意 UI 側で記憶してください（参照実装では信頼済みオリジンとして保存）。これでログインフローの摩擦は初回のみになります。

> **破壊的変更（セキュリティ修正）:** 以前のバージョンは `getPublicKey` / `getRelays` を同意なしで返していました。デフォルトの `requireUserConsent: true` のままのホストは `onConsent` を必ず提供してください。未提供の場合、これらのメソッドは `INTERNAL` エラーになります。従来のサイレント動作に戻すには `requireUserConsent: false` を明示してください。なお `onGetRelays` 未設定または鍵未設定のときの `getRelays` は従来どおり同意なしで `{}` を返します。

> **破壊的変更（secure-by-default）:** `allowedOrigins` は **必須** になりました（`'*'` のデフォルトは廃止）。省略するとコンストラクタで throw します。親オリジンが分かる場合（セルフホスト統合等）は明示的な許可リストを、オープン埋め込みを意図的に有効化する場合は `'*'` を渡してください。オープン埋め込みモデル自体は引き続き利用できますが、「全オリジン許可」がサイレントなデフォルトにならないようにする変更です。

詳細アーキテクチャ (同意 UI パターン、Storage Access API、7 メソッドの NIP-07 実装、embedded テーマ/言語伝搬) は
[`docs/ja/iframe-host.ja.md`](../../docs/ja/iframe-host.ja.md) を参照。
参照実装の Svelte アプリは [`examples/svelte-app`](../../examples/svelte-app) (ルート `#/iframe`) にあります。

---

## ブラウザ権限・デプロイチェックリスト

本番デプロイ前に以下を確認:

- host ページが `Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*` を返している。
- 親ページが `allow="publickey-credentials-get; publickey-credentials-create"` で iframe を埋め込んでいる (`NosskeyIframeClient` を使えば自動)。
- host ページが `Content-Security-Policy: frame-ancestors` で親オリジンを許可リスト化している。
- 両側が HTTPS で配信されている (WebAuthn 必須)。
- host ページの実効オリジンが、パスキー作成時の WebAuthn RP-ID と一致する。
- 親がクロスオリジンの場合、host 側がユーザージェスチャ上で `document.requestStorageAccess({ all: true })` を呼んでいる (Chrome 115+ では第三者 iframe storage が partition される)。詳細は上記 host ガイド参照。

---

## API リファレンス (名前付き export)

| Export | 役割 | 説明 |
|---|---|---|
| `NosskeyIframeClient` | Client | iframe をマウントし NIP-07 呼び出しを転送する。 |
| `NosskeyIframeClientOptions` | Client | コンストラクタオプション (iframe URL、container、timeout、theme、lang)。 |
| `NosskeyIframeError` | Client | client メソッドが投げる型付きエラー。 |
| `NosskeyIframeHost` | Host | `postMessage` を listen し、`NosskeyManager` 経由で応答する。 |
| `NosskeyIframeHostOptions` | Host | コンストラクタオプション (manager、許可オリジン、consent hook)。 |
| `NosskeyManagerLike` | Host | host が要求する `nosskey-sdk` の `NosskeyManager` の構造的サブセット。 |
| `ConsentRequest` | Host | `onConsent` に渡される引数の形。 |
| `NostrEvent` | 共通 | NIP-01 Nostr イベント JSON。`nosskey-sdk` のものと構造的に同一の型をここで local 定義し export。consumer が `nosskey-sdk` を入れずに型だけ使える。 |
| `NosskeyMethod`, `NosskeyRequest`, `NosskeyRequestParams`, `NosskeyResponse`, `NosskeyReady`, `NosskeyVisibility`, `NosskeyMessage`, `RelayMap`, `NosskeyErrorCode`, `NOSSKEY_ERROR_CODES` | 共通 | プロトコルの型と定数。 |
| `isNosskeyRequest`, `isNosskeyResponse`, `isNosskeyReady`, `isNosskeyVisibility`, `isEncryptMethod`, `isDecryptMethod` | 共通 | プロトコルメッセージのランタイム型ガード。 |

完全な型シグネチャは同梱の `.d.ts` を参照してください。

---

## 動作環境

- **Node**: ≥22 (ツールチェイン用途のみ。本ライブラリ自体はブラウザパッケージ)。
- **ブラウザ**: Chrome / Edge 118+ ✔、Firefox (最新) は PRF 部分対応、Safari は iframe 内では不安定。[PRF 対応状況](../../docs/ja/prf-support-tables.ja.md) を参照。
- **暗号**: host 側の鍵導出に WebAuthn PRF 拡張が必要。client 自体はブラウザ標準以外の暗号要件なし。

---

## ライセンス

MIT — [`LICENSE`](./LICENSE) を参照。

Nosskey プロジェクト全体の README は [モノレポルート](https://github.com/ocknamo/nosskey-sdk#readme) を参照。
