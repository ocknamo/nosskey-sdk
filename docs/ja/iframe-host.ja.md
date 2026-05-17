# Nosskey iframe ホスト (`examples/svelte-app`) 解説

`examples/svelte-app` は、`#/iframe` ルートでアクセスされた際に **Nostr 署名プロバイダ iframe としてのみ動作するモード**に切り替わる構成になっています。本ドキュメントではその仕組みを解説します。

本番では [`https://nosskey.app/#/iframe`](https://nosskey.app/#/iframe) として配信され、別 origin の Nostr アプリが iframe で埋め込んで利用します。

## 全体像

通常 UI (ヘッダー / フッター / 各画面) は一切描画せず、親ページからの postMessage 要求を処理することに専念します。

親アプリ (別 origin) は [`nosskey-iframe`](../../packages/nosskey-iframe) パッケージの `NosskeyIframeClient` 経由でこの iframe と通信し、Nosskey origin (`nosskey.app`) に紐づいた **1 つのパスキーを全 Nostr アプリで共有**できるようにします。

## 対応メソッド

iframe ホストは **NIP-07 の完全なプロバイダ**です。7 つのメソッドを処理し、そのうち 5 つは秘密情報を扱うため consent フローを経由します。

| メソッド (プロトコル) | SDK メソッド | consent | 用途 |
|----------------------|--------------|---------|------|
| `getPublicKey`  | `getPublicKey()`  | — (不要)   | 現在の公開鍵を返す |
| `getRelays`     | (host コールバック) | — (不要)   | リレー設定を返す |
| `signEvent`     | `signEvent()`     | 必要       | Nostr イベントに署名 |
| `nip44_encrypt` | `nip44Encrypt()`  | 必要       | NIP-44 v2 暗号化 |
| `nip44_decrypt` | `nip44Decrypt()`  | 必要       | NIP-44 v2 復号 |
| `nip04_encrypt` | `nip04Encrypt()`  | 必要       | NIP-04 (レガシー) 暗号化 |
| `nip04_decrypt` | `nip04Decrypt()`  | 必要       | NIP-04 (レガシー) 復号 |

プロトコル上のメソッド名 (アンダースコア形式) と `CONSENT_REQUIRED_METHODS` リストは [`packages/nosskey-iframe/src/protocol.ts`](../../packages/nosskey-iframe/src/protocol.ts) で定義されています。`getPublicKey` と `getRelays` は非機密データのみを返すため、ダイアログは出ません。

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
- 起動時に **Storage Access API** のリカバリフローを実行し (後述の [Storage Partitioning](#storage-partitioning-と-storage-access-api))、対応が必要なときだけ状態カード (`partitioned` / `denied` / `granted` / `noKeyExists` / `unsupported`) を表示
- 埋め込みモードで起動された場合は `body.nosskey-embedded` クラスを付与し、親が用意したカードにモーダルを馴染ませる

### 3. Host 起動と Consent ブリッジ — `iframe-mode.ts`

```ts
export const pendingConsent = writable<PendingConsent | null>(null);

export function onConsent(request: ConsentRequest): Promise<boolean> {
  const evaluation = evaluateConsent(request, {
    trustedOrigins: get(trustedOrigins),
    policy: get(consentPolicy),
  });
  if (evaluation.decision === 'approve') return Promise.resolve(true);
  if (evaluation.decision === 'reject') {
    // policy=deny: サイレントなプローブを観測可能にするため warn + カウント
    incrementDenyCount(policyKeyFor(request.method));
    return Promise.resolve(false);
  }
  // decision === 'ask': ダイアログを表示しユーザー操作を待つ
  return new Promise<boolean>((resolve) => {
    pendingConsent.set({
      ...request,
      resolve: (approved, options) => {
        if (approved) rememberOriginIfRequested(request, options);
        resolve(approved);
      },
    });
  });
}

export function startIframeHost(overrides = {}) {
  const manager = getNosskeyManager();
  const host = new NosskeyIframeHost({
    manager,
    allowedOrigins: '*',
    requireUserConsent: true,
    onConsent,
    onGetRelays: async () => loadRelays(manager.getStorageOptions().storage),
    ...overrides,
  });
  host.start();
  return () => host.stop();
}
```

ポイント:

- **既存 SDK の再利用**: `getNosskeyManager()` で `NosskeyManager` シングルトンを取得し、そのまま Host に渡す (鍵は localStorage 経由で永続化済み)
- **consent は単なる確認ではなくゲート**: `onConsent` は副作用のない純粋関数 `evaluateConsent()` に委譲する。保存済みポリシー / 信頼済みオリジンに応じて自動承認・自動拒否・ダイアログ表示のいずれかに分岐する
- **Promise ブリッジ**: `ask` 経路では Promise を返し、その `resolve` を `pendingConsent` store に退避。UI のボタンが押されるまで Host は待機
- **`getRelays` コールバック**: `onGetRelays` は SDK のストレージハンドル経由でリレーマップを読むため、Storage Access グラント後はファーストパーティのストレージを参照する
- `allowedOrigins: '*'` はデモ用に postMessage の入口を全許可する設定であり、オリジンフィルタ**ではない**。本番ホストでは特定 origin の許可リストに絞ること

### 4. Consent ゲーティング — `consent-gating.ts` + `app-state.ts`

ダイアログを出す前に、`evaluateConsent()` ([`utils/consent-gating.ts`](../../examples/svelte-app/src/utils/consent-gating.ts)) が副作用なく結果を決定します。評価順 (安全側優先):

1. メソッドポリシーが `deny` → 即**拒否** (信頼済みオリジンより優先)
2. メソッドポリシーが `always` → 即**承認**
3. 要求元 origin が**このメソッドについて**信頼済み → **承認**
4. それ以外 → **ask** (ダイアログ表示)

この判定を駆動する 2 つの永続状態 (いずれも [`store/app-state.ts`](../../examples/svelte-app/src/store/app-state.ts)):

- **`ConsentPolicy`** — メソッド別の判定 (`ask` / `always` / `deny`)。キーは `signEvent` / `nip44` / `nip04`。`nip44_encrypt` と `nip44_decrypt` は `nip44` バケットに集約される (`nip04` も同様)。`localStorage` キー `nosskey_consent_policy` に保存。
- **`TrustedOriginEntry[]`** — 「このサイトを常に許可」の記録。origin をまるごと許可するのではなく `origin × method` 単位でスコープする。`localStorage` キー `nosskey_trusted_origins_v2` に保存。

自動拒否されたリクエストはメソッド別の `denyCounts` store を加算します。これにより、悪意ある親が (例: 任意 pubkey に対する `nip04_decrypt` を繰り返すなど) ユーザーに気づかれずプローブし続けることを防ぎます。

ポリシーと信頼済みオリジンはいずれも設定画面 (`ConsentPolicySettings.svelte` / `TrustedOriginsSettings.svelte`) から編集できます。

### 5. 承認 UI — `ConsentDialog.svelte`

`$pendingConsent` が非 null のときのみモーダル表示します。要求メソッドに応じて表示が変わります:

- **origin**: 要求元ページの URL
- **method**: 人間可読なラベル (`signEvent` / NIP-44・NIP-04 の encrypt・decrypt)
- **`signEvent` の場合**: `event.kind` を可読ラベル化 (`kindLabel()`)、`content` は **100 文字**で truncate、タグ一覧、raw event JSON 全体を `<details>` で折りたたみ表示
- **nip44/nip04 の場合**: 相手 pubkey を短縮 `npub` 表示 (`renderPeerPubkey()`)。encrypt 要求では平文も 100 文字プレビュー、decrypt 要求では平文プレビューなし
- **3 ボタン**:
  - **拒否** → `rejectConsent()`
  - **常に許可** → `approveConsent({ trustOrigin: true })` — 承認し、`origin × method` を信頼リストへ追加
  - **一度だけ許可** → `approveConsent({ trustOrigin: false })`

## 通信フロー

### `signEvent` (consent 必要)

```
親ページ                         svelte-app (iframe)
──────                          ───────────────────
client.signEvent(event)
  │ postMessage
  ▼
                                NosskeyIframeHost 受信
                                  │
                                  ▼
                                onConsent(request) → evaluateConsent()
                                  │
                                  ├─ policy=deny  → 拒否 (ダイアログなし)
                                  ├─ policy=always / 信頼済みオリジン → 承認
                                  │                                  (ダイアログなし)
                                  └─ ask → pendingConsent store → ConsentDialog
                                            │ ユーザーが「一度だけ許可」/
                                            │ 「常に許可」をクリック
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

### `nip44.encrypt` / `nip04.encrypt` / `*.decrypt`

暗号化系メソッドも同じ consent 経路をたどります。Host は対応する SDK メソッド (`manager.nip44Encrypt(pubkey, plaintext)` 等) を呼び、暗号文 (decrypt の場合は平文) を親に返します。

### `getPublicKey` / `getRelays` (consent 不要)

これらは即座に解決します。`getPublicKey` は現在の `NostrKeyInfo` から、`getRelays` は `onGetRelays` コールバックから取得し、consent フローを経由しません。

## Storage Partitioning と Storage Access API

Chrome 115+ や Firefox の Total Cookie Protection では、**サードパーティ iframe の `localStorage` が top-level 親オリジンごとに分離 (partition)** されます。`nosskey.app` をトップレベルで開いて保存した `NostrKeyInfo` は、別ドメインの親ページに埋め込まれた iframe からは参照できず、素朴に呼ぶと最初の呼び出しで `NO_KEY` が返ります。

`IframeHostScreen.svelte` は次の手順でリカバーします:

1. マウント時に `document.requestStorageAccess({ all: true })` を呼ぶ。この `top-level × iframe` オリジンの組に対して過去のグラントを覚えているブラウザは**サイレントに**解決する (ユーザージェスチャ不要) ため、再訪ユーザーはプロンプトをスキップできる。
2. 初回訪問 / グラント期限切れでは `NotAllowedError` で reject される。その場合は `partitioned` カードと「アクセスを許可」ボタンを表示し、`nosskey:visibility { visible: true }` を post して親に iframe を表示させ、必要なユーザージェスチャを得る。
3. グラント成功時、Chromium のハンドルが持つ `localStorage` を `manager.setStorageOptions({ storage })` で SDK シングルトンに配線する (Chromium はグラント後も `window.localStorage` を partitioned のまま保持し、ハンドルだけがファーストパーティを指す)。`reloadSettings()` で consent ポリシー・信頼済みオリジン・キャッシュ設定を同じハンドル経由で読み直す。
4. すでに partitioned 側に鍵がある場合、グラント前でもキャッシュ済みの鍵で署名は可能。ファーストパーティのデータ (リレー設定等) はアクセス許可まで参照できない。

`nosskey:visibility` postMessage はプロトコルの一部であり、親側の `NosskeyIframeClient` が iframe 要素の表示/非表示を自動で切り替えます。

## テーマ・言語・埋め込みモード

親アプリは URL クエリパラメータで表示設定を渡せます。`NosskeyIframeClient` が `buildIframeUrl()` ヘルパー経由で付与します:

- `?theme=light|dark|auto` — `app-state.ts` が適用
- `?lang=ja|en|auto` — `i18n-store.ts` が適用
- `?embedded=1` — `theme` または `lang` を指定すると自動で付与される

埋め込みモード (`embedded=1`) では、iframe は**テーマ / 言語を `localStorage` に書き戻しません**。これにより、後でスタンドアロンで開いたときにユーザー自身の設定が保たれます。あわせて `body.nosskey-embedded` クラスを付与し、body を透明化して consent モーダルを親が用意したカード枠にシームレスに収めます。

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

- [親ページ側の利用方法 (ルート README)](../../README.ja.md#iframe-モードクロスオリジン署名)
- [`nosskey-iframe` パッケージ](../../packages/nosskey-iframe)
- [iframe 機能拡充計画](../iframe-expansion-plan.md) — ロードマップと進捗
- [Nosskey 仕様](./nosskey-specification.ja.md)
