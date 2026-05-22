# Nosskey iframe 埋め込みガイド (親アプリ向け)

このドキュメントは、**自分の Nostr Web アプリに Nosskey の署名 iframe を埋め込んで利用したい開発者**向けの手順書です。本番ホスト [`https://nosskey.app/#/iframe`](https://nosskey.app/#/iframe) を例に、[`nosskey-iframe`](../../packages/nosskey-iframe) パッケージの `NosskeyIframeClient` を使った統合方法を解説します。

> iframe ホスト側 (`examples/svelte-app` の `#/iframe` ルート) の内部構造については [`iframe-host.ja.md`](./iframe-host.ja.md) を参照してください。

## 概要

`nosskey.app/#/iframe` を iframe として埋め込むと、親アプリは**秘密鍵を一切扱わずに** Nostr の署名・暗号化機能を利用できます。

- 鍵は `nosskey.app` オリジンに紐づくパスキー (WebAuthn PRF) から導出され、iframe の中だけで使われます。秘密鍵が親アプリへ渡ることはありません。
- 親アプリは [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) の `window.nostr` 互換 API を得られます。既存の Nostr クライアントへドロップインで組み込めます。
- 埋め込んだ全アプリで同じパスキーを共有するため、ユーザーは「Nosskey というアイデンティティ」を複数の Nostr アプリで使い回せます。

対象読者: 別オリジンの Nostr Web アプリ開発者。

## 仕組みの概要

親ページと iframe は `window.postMessage` で JSON-RPC 風のメッセージを交換します。`NosskeyIframeClient` がこの通信を隠蔽するため、`postMessage` を直接書く必要はありません。

```
親アプリ                              nosskey.app/#/iframe
────────                              ────────────────────
new NosskeyIframeClient(...)
  │ iframe 要素を生成・マウント
  ▼
                                      iframe ホスト起動
  await client.ready() ◄────────────  nosskey:ready
  │
  ▼
window.nostr = { ... } を設定

client.signEvent(event)
  │ nosskey:request ───────────────►  consent ダイアログ表示
  │                                     │ ユーザーが承認
  │ nosskey:response ◄────────────────  WebAuthn PRF で署名
  ▼
署名済みイベントを取得
```

ポイント:

- **`nosskey:ready` ハンドシェイク**: iframe の準備完了を `client.ready()` で待ってから利用します。
- **consent ダイアログは iframe 内に表示**: 署名・暗号化などの操作はユーザー承認を経ます。ダイアログは iframe の中でレンダリングされます。
- **表示の自動切替**: ダイアログやストレージ許可が必要なとき、iframe から親へ `nosskey:visibility` メッセージが送られ、`NosskeyIframeClient` が iframe 要素の表示/非表示を自動で切り替えます。

## 前提条件

- **ブラウザ**: Chrome 118 以降を推奨。Firefox は PRF サポートが限定的、Safari / iOS は現時点で非対応です。
- **HTTPS**: 親ページは HTTPS (または `localhost`) で配信する必要があります。WebAuthn の要件です。
- **パスキーの事前作成**: ユーザーは事前に `https://nosskey.app` を直接開いてパスキー (Nosskey アイデンティティ) を作成しておく必要があります。未作成の場合、署名系メソッドは `NO_KEY` エラーを返します。

## インストール

```sh
npm install nosskey-iframe
```

`nosskey-iframe` は `nosskey-sdk` に依存しており、`NostrEvent` などの型定義もそこから提供されます。

## 最小構成

```ts
import { NosskeyIframeClient } from 'nosskey-iframe';

const client = new NosskeyIframeClient({
  iframeUrl: 'https://nosskey.app/#/iframe',
});

// iframe の準備完了 (nosskey:ready) を待つ
await client.ready();

// NIP-07 互換の window.nostr を公開する
window.nostr = {
  getPublicKey: () => client.getPublicKey(),
  signEvent: (event) => client.signEvent(event),
  getRelays: () => client.getRelays(),
  nip44: {
    encrypt: (peer, plaintext) => client.nip44.encrypt(peer, plaintext),
    decrypt: (peer, ciphertext) => client.nip44.decrypt(peer, ciphertext),
  },
  nip04: {
    encrypt: (peer, plaintext) => client.nip04.encrypt(peer, plaintext),
    decrypt: (peer, ciphertext) => client.nip04.decrypt(peer, ciphertext),
  },
};
```

`NosskeyIframeClient` のコンストラクタは iframe 要素を生成し、`document.body` (または後述の `container`) へ追加します。iframe には WebAuthn に必要な `allow="publickey-credentials-get; publickey-credentials-create"` 属性が自動付与されます。

## 対応メソッド

`NosskeyIframeClient` は NIP-07 の全 7 メソッドを提供します。秘密情報を扱う 5 メソッドはユーザー consent を経由します。

| クライアント API | 戻り値 | consent | 用途 |
|------------------|--------|---------|------|
| `getPublicKey()` | `Promise<string>` | 不要 | 公開鍵 (hex) を返す |
| `getRelays()` | `Promise<RelayMap>` | 不要 | リレー設定を返す |
| `signEvent(event)` | `Promise<NostrEvent>` | 必要 | Nostr イベントに署名 |
| `nip44.encrypt(peer, plaintext)` | `Promise<string>` | 必要 | NIP-44 v2 暗号化 |
| `nip44.decrypt(peer, ciphertext)` | `Promise<string>` | 必要 | NIP-44 v2 復号 |
| `nip04.encrypt(peer, plaintext)` | `Promise<string>` | 必要 | NIP-04 (レガシー) 暗号化 |
| `nip04.decrypt(peer, ciphertext)` | `Promise<string>` | 必要 | NIP-04 (レガシー) 復号 |

`peer` は相手の公開鍵 (32 バイト hex) です。`RelayMap` は `Record<string, { read: boolean; write: boolean }>` 型です。

> NIP-04 は認証なし (AES-CBC) のレガシー方式です。新規実装では NIP-44 v2 を使ってください。NIP-04 は古いクライアントとの相互運用のためにのみ残されています。

## クライアントオプション

`NosskeyIframeClient` のコンストラクタは `NosskeyIframeClientOptions` を受け取ります。

| オプション | 型 | 既定値 | 説明 |
|-----------|-----|--------|------|
| `iframeUrl` | `string` | (必須) | Nosskey iframe の絶対 URL。例: `https://nosskey.app/#/iframe` |
| `container` | `HTMLElement` | `document.body` | iframe 要素を追加する親要素 |
| `timeout` | `number` | `60000` | リクエストのタイムアウト (ミリ秒) |
| `theme` | `'light' \| 'dark' \| 'auto'` | (未指定) | iframe に渡すテーマ。`auto` は iframe 内で `prefers-color-scheme` により解決される |
| `lang` | `'ja' \| 'en' \| 'auto'` | (未指定) | iframe に渡す言語。`auto` は iframe 内で `navigator.language` により解決される |

- `theme` / `lang` を指定すると、iframe URL に `?embedded=1&theme=...&lang=...` が自動付与されます。
- `theme` / `lang` は **iframe のロード時にのみ適用**されます。実行時に切り替えるには、`destroy()` してから新しい値でクライアントを作り直してください。

## iframe の配置と表示制御

`NosskeyIframeClient` が生成する iframe は、初期状態では `display: none` で非表示です。署名や暗号化の consent ダイアログ、あるいはストレージアクセスの許可が必要になると、iframe から `nosskey:visibility` メッセージ (`{ type: 'nosskey:visibility', visible: boolean }`) が送られ、`NosskeyIframeClient` が iframe 要素の `display` を自動で切り替えます。

ただし、**iframe をどこに・どんな大きさで配置するかは親アプリの責任**です。consent ダイアログをユーザーが操作できるよう、iframe を画面内の見える位置に配置してください。推奨パターンはモーダル/オーバーレイです。

```ts
const client = new NosskeyIframeClient({
  iframeUrl: 'https://nosskey.app/#/iframe',
  theme: 'auto',
  lang: 'auto',
});

// 生成済みの iframe 要素を取得し、モーダルカード内へ移動する
const modalCard = document.querySelector('#nosskey-modal .card');
modalCard.appendChild(client.iframe);

await client.ready();
```

- `client.iframe` で iframe 要素 (`HTMLIFrameElement`) を取得できます。CSS でサイズ・位置・`z-index` を整えてください。
- 親アプリ側でもバックドロップ等を表示したい場合は、`window.addEventListener('message', ...)` で `nosskey:visibility` メッセージを購読し、モーダル枠の表示を同期させます。
- `theme` / `lang` を指定して埋め込みモード (`embedded=1`) で起動すると、iframe は body を透過化し、consent モーダルが親の用意したカード枠に馴染むように描画されます。

## ストレージ分離 (Storage Partitioning) への対応

Chrome 115+ や Firefox の Total Cookie Protection では、**クロスオリジン iframe の `localStorage` が親オリジンごとに分離 (partition)** されます。`nosskey.app` をトップレベルで開いて保存したパスキー情報は、別オリジンの親ページに埋め込まれた iframe からは初期状態では参照できず、最初の `getPublicKey()` / `signEvent()` は `NO_KEY` エラーを返します。

iframe ホストは Storage Access API でこれを自動的にリカバリします:

1. iframe がストレージ分離を検知し、`nosskey:visibility { visible: true }` を送って自身を表示させます。
2. ユーザーが iframe 内の「ストレージアクセスを許可」ボタンをクリックします。
3. ブラウザが許可ダイアログを表示します。承認されると iframe がファーストパーティのストレージから鍵を読み直し、自身を非表示に戻します。
4. 親アプリは `getPublicKey()` / `signEvent()` を再試行すれば成功します。

このフローはホスト側と `NosskeyIframeClient` が自動処理しますが、**「ストレージアクセスを許可」ボタンをユーザーがクリックできるよう、iframe を見える位置に配置しておく必要があります** (前節参照)。ユーザーが許可を拒否した場合や Storage Access API 非対応ブラウザでは、`nosskey.app` を別タブで直接開いて操作してもらうのが代替手段です。

詳細は [`iframe-host.ja.md`](./iframe-host.ja.md#storage-partitioning-と-storage-access-api) を参照してください。

## エラーハンドリング

iframe がエラー応答を返すと、対応するメソッドの Promise は `NosskeyIframeError` で reject されます。`error.code` でエラー種別を判定できます。

```ts
import { NosskeyIframeError } from 'nosskey-iframe';

try {
  const pubkey = await client.getPublicKey();
} catch (err) {
  if (err instanceof NosskeyIframeError) {
    if (err.code === 'NO_KEY') {
      // iframe にパスキーが未設定、またはストレージ分離で鍵が見えていない
    } else if (err.code === 'USER_REJECTED') {
      // ユーザーが consent ダイアログで拒否した
    }
  }
}
```

| エラーコード | 意味 |
|-------------|------|
| `NO_KEY` | iframe にパスキーが設定されていない、またはストレージ分離で鍵が見えていない |
| `USER_REJECTED` | ユーザーが consent ダイアログで拒否した |
| `NOT_AUTHORIZED` | リクエスト元オリジンが許可されていない |
| `UNKNOWN_METHOD` | 未対応のメソッドを呼び出した |
| `INVALID_REQUEST` | パラメータが不正 |
| `INTERNAL` | iframe 内部のエラー |

このほか、`timeout` (既定 60 秒) を超えると通常の `Error` で reject されます。

## クリーンアップ

不要になったら `destroy()` を呼びます。iframe 要素の除去、`message` リスナーの解除、保留中リクエストの reject を行います。

```ts
client.destroy();
window.nostr = undefined;
```

## 完全な実装例

動作する親アプリの実装例として、リポジトリの [`examples/parent-sample`](../../examples/parent-sample) を参照してください。Vanilla TypeScript + Vite で、モーダル配置・`window.nostr` 設定・各 NIP メソッドの呼び出し・`NO_KEY` ハンドリングを一通り実装しています。

このサンプルは [https://ocknamo.github.io/nosskey-sdk/](https://ocknamo.github.io/nosskey-sdk/) でホスティングされており、ブラウザ上で実際の埋め込み動作を試せます。

要点となるモーダル配置のスニペット:

```ts
const client = new NosskeyIframeClient({ iframeUrl, theme, lang });
// 生成済みの iframe をモーダルカードへ移動する
modalCard.appendChild(client.iframe);
await client.ready();
window.nostr = {
  /* ... 上記「最小構成」を参照 ... */
};
```

## 本番運用の注意

- **`allow` 属性**: WebAuthn を iframe 内で実行するための `allow="publickey-credentials-get; publickey-credentials-create"` 属性は `NosskeyIframeClient` が自動付与します。親側で設定する必要はありません。
- **Permissions-Policy ヘッダ**: iframe ホスト側が `Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*` ヘッダを返す必要があります。`nosskey.app` は対応済みです。
- **ブラウザ対応**: 下表のとおりです。

| ブラウザ | PRF 拡張 | iframe + WebAuthn | 状態 |
|---------|---------|-------------------|------|
| Chrome 118+ | ✅ | ✅ (Permissions-Policy 必要) | 対応 |
| Firefox (最新) | 限定的 | 仕様準拠 | 限定的 |
| Safari / iOS | 限定的 (Safari 18) | iframe 内で不安定 | **非対応** |

自前で iframe ホストをホスティングしたい場合は、[`iframe-host.ja.md`](./iframe-host.ja.md) でホスト側の構成 (`NosskeyIframeHost`、consent フロー、Permissions-Policy) を解説しています。

## 関連ドキュメント

- [iframe ホスト機能の解説](./iframe-host.ja.md) — `#/iframe` ルートで動作する iframe ホスト側の仕組み
- [`nosskey-iframe` パッケージ](../../packages/nosskey-iframe) — ソースコード
- [`examples/parent-sample`](../../examples/parent-sample) — 親アプリの実装例
- [親アプリのライブデモ](https://ocknamo.github.io/nosskey-sdk/) — `examples/parent-sample` のホスティング版
- [ルート README](../../README.ja.md) — Nosskey SDK 全体の概要
- [Nosskey 仕様](./nosskey-specification.ja.md)
