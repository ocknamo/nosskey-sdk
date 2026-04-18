# Nosskey iframe ホスト (`examples/svelte-app`) 解説

`examples/svelte-app` は、`#/iframe` ルートでアクセスされた際に **Nostr 署名プロバイダ iframe としてのみ動作するモード**に切り替わる構成になっています。本ドキュメントではその仕組みを解説します。

本番では [`https://nosskey.app/#/iframe`](https://nosskey.app/#/iframe) として配信され、別 origin の Nostr アプリが iframe で埋め込んで利用します。

## 全体像

通常 UI (ヘッダー / フッター / 各画面) は一切描画せず、親ページからの postMessage 要求を処理することに専念します。

親アプリ (別 origin) は [`nosskey-iframe`](../../packages/nosskey-iframe) パッケージの `NosskeyIframeClient` 経由でこの iframe と通信し、Nosskey origin (`nosskey.app`) に紐づいた **1 つのパスキーを全 Nostr アプリで共有**できるようにします。

## 構成要素

### 1. ルーティング — `App.svelte`

```svelte
{#if screen === "iframe"}
  <IframeHostScreen />   <!-- iframe モード: UI 最小限 -->
{:else}
  <HeaderBar /> ... <FooterMenu />   <!-- 通常 UI -->
{/if}
```

`#/iframe` を検知した時点でルートごと差し替えるため、iframe 内で不要な UI のチラ見えやスタイル干渉が起きません。

### 2. エントリ画面 — `IframeHostScreen.svelte`

- `onMount` で `startIframeHost()` を呼び `NosskeyIframeHost` を起動
- `onDestroy` で stop 関数を呼び postMessage リスナー解除
- `<ConsentDialog />` を常時マウント (承認要求時だけ表示)
- 初期状態で鍵が無ければ警告文を表示

### 3. Host 起動と Consent ブリッジ — `iframe-mode.ts`

```ts
export const pendingConsent = writable<PendingConsent | null>(null);

function onConsent(request: ConsentRequest): Promise<boolean> {
  return new Promise((resolve) => {
    pendingConsent.set({ ...request, resolve });
  });
}

export function startIframeHost(overrides = {}) {
  const host = new NosskeyIframeHost({
    manager: getNosskeyManager(),
    allowedOrigins: '*',
    requireUserConsent: true,
    onConsent,
    ...overrides,
  });
  host.start();
  return () => host.stop();
}
```

ポイント:

- **既存 SDK の再利用**: `getNosskeyManager()` で `NosskeyManager` シングルトンを取得し、そのまま Host に渡す (鍵は localStorage 経由で永続化済み)
- **Promise ブリッジ**: Host 側が `onConsent` を呼ぶと Promise を返却し、resolve は store に退避。UI のボタンが押されるまで Host は待機
- **ユーザー操作の反映**: `approveConsent()` / `rejectConsent()` が store の resolve を呼んで Promise を決着させる
- `allowedOrigins: '*'` はデモ用設定。本番では特定 origin の許可リストに絞るべき

### 4. 承認 UI — `ConsentDialog.svelte`

`$pendingConsent` が非 null のときのみモーダル表示します:

- **origin**: 要求元ページの URL
- **event.kind / content / tags**: 署名対象イベントの中身 (content は 240 文字で truncate)
- 承認 / 拒否ボタン → それぞれ `approveConsent()` / `rejectConsent()`

`getPublicKey` は consent 不要 (公開鍵なので)、`signEvent` のみダイアログを出します。

## 通信フロー (signEvent の場合)

```
親ページ                         svelte-app (iframe)
──────                          ───────────────────
client.signEvent(event)
  │ postMessage
  ▼
                                NosskeyIframeHost 受信
                                  │
                                  ▼
                                onConsent(request) 呼び出し
                                  │
                                  │ pendingConsent store に push
                                  ▼
                                ConsentDialog 表示
                                  │
                                  │ ユーザーが「承認」
                                  ▼
                                approveConsent() → resolve(true)
                                  │
                                  ▼
                                manager.signEvent(event)
                                  │ (WebAuthn PRF で署名)
                                  ▼
  postMessage ◄── 署名済イベント
  │
  ▼
client.signEvent Promise 解決
```

## 本番配置との関係

- **本番 URL**: `https://nosskey.app/#/iframe` (Cloudflare Pages にデプロイ)
- **Permissions-Policy**: ホスト側 (svelte-app のホスティング) が以下のヘッダを返す必要あり

  ```
  Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*
  ```

- **埋め込み側の属性**: Chrome では以下の `allow` 属性が必須

  ```html
  <iframe allow="publickey-credentials-get; publickey-credentials-create"></iframe>
  ```

  `NosskeyIframeClient` を使えば自動付与されます。

## パスキー共有のメカニズム

1. ユーザーは初回 `https://nosskey.app/#/account` でパスキーを作成 (RP ID = `nosskey.app`)
2. その後、別アプリ A, B, C が `https://nosskey.app/#/iframe` を埋め込む
3. 各アプリから同じパスキーで署名可能 — WebAuthn は origin (`nosskey.app`) 拘束なので、iframe 内では同一パスキーが使える
4. 鍵情報 (`NostrKeyInfo`) は svelte-app 側の localStorage に保存されるが、PRF 値は毎回 WebAuthn で再導出されるため秘密鍵そのものは露出しない

これにより「Nostr アプリごとに別パスキー」ではなく「**Nosskey というアイデンティティを全 Nostr アプリで共有**」が実現できます。

## 関連ドキュメント

- [親ページ側の利用方法 (ルート README)](../../README.md#iframe-mode-cross-origin-signing)
- [`nosskey-iframe` パッケージ](../../packages/nosskey-iframe)
- [Nosskey 仕様](./nosskey-specification.ja.md)
