# Nostr Web クライアントに「Nosskey でログイン」(パスキー) を追加する

> AI コーディングエージェント向けの手順書です。この手順に従うと、`nosskey-iframe` npm パッケージを使ってホスト型の Nosskey 署名 iframe (`https://nosskey.app/#/iframe`) を埋め込み、既存の Nostr Web クライアントにパスキーでのログインを追加できます。
>
> `nosskey-iframe` 0.2.0 と、nosskey.app で動いているリファレンスのホストに照らして確認しています。
>
> 英語版 [`nosskey-iframe-login.md`](./nosskey-iframe-login.md) と同じ内容です。コードブロックは英語版と同一で、コメントと画面の文言も英語のままにしています。

<!-- 保守する人へ: 原本は英語版で、このファイルはその翻訳です。先に英語版を直し、そのあとこのファイルを合わせてください。コードブロックは英語版と一字一句同じに保ちます。 -->

参照実装 (Nosskey の作者による本番アプリ) は次のとおりです。

- **combine** (Svelte 5): もっとも使い込まれている導入例です。参照するファイルは [`src/lib/auth.svelte.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/auth.svelte.ts)、[`src/lib/nip07.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/nip07.ts)、[`src/app.css`](https://github.com/ocknamo/combine/blob/main/src/app.css) (`.nosskey-overlay`) です。
- **yakitofu** (SvelteKit): NIP-07 と Nosskey を並べて選べるログインモーダルがあります。参照するファイルは [`src/lib/components/LoginModal.svelte`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/components/LoginModal.svelte)、[`src/lib/services/nosskey.ts`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/services/nosskey.ts)、[`src/lib/services/signer.ts`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/services/signer.ts) です。

**これらのアプリから写してよいのはオーバーレイ、`MutationObserver`、遅延生成するシングルトン、ログインモーダルの構成だけです。** どちらのアプリにも §3 のルールに反する箇所があり、食い違うところではこのガイドに従ってください。

- combine は `visibilitychange` のたびに `getPublicKey()` を呼び (`reconcileSession`)、起動時に `getRelays()` を呼んでいます (`App.svelte` の `refreshRelays`)。どちらも R3 に反します。
- combine は `window.nostr` の shim を無条件に組み込んでいます。NIP-07 ログインも提供するアプリでは R5 に反します。
- yakitofu はログアウト時に `destroy()` を呼んでおり、R2 に反します。また、`Signer` の `getPublicKey()` がセッションから答えず、iframe に問い合わせています。

---

## 1. 作るもの

- クライアントアプリに「Nosskey でログイン」というログイン方法を追加します。
- ユーザーがこれを選ぶと、アプリは `nosskey.app` のクロスオリジン iframe を非表示でマウントし、`postMessage` 経由で `getPublicKey()` を呼びます。
- `nosskey.app` は iframe の中に自前のダイアログを表示します。ブラウザの状態によって、接続の承認か、ストレージアクセスの許可のどちらかです。ユーザーが承認すると、アプリはユーザーの pubkey を受け取ります。
- その後の `signEvent()` も同じ iframe を通ります。`nosskey.app` が承認を求め、ユーザーのパスキーから鍵を導出します (WebAuthn PRF)。

ユーザーに伝えておくべきトレードオフ: パスキーは `nosskey.app` のものです (WebAuthn の RP は `nosskey.app`)。そのため、ユーザーのアイデンティティは nosskey.app が稼働していることに依存します。

## 2. API についての事実 (推測しないこと)

- パッケージは `nosskey-iframe` です。client 側にランタイム依存はありません。`nosskey-sdk` は optional な peer dependency で、署名 iframe を自前でホストする場合だけ必要です。`NostrEvent` などの型は `nosskey-iframe` から import します。
- iframe の URL は `https://nosskey.app/#/iframe` です。どの親オリジンも受け付けるので、事前の登録は要りません。
- client は NIP-07 の 7 メソッドすべて (`getPublicKey`、`getRelays`、`signEvent`、`nip44.encrypt/decrypt`、`nip04.encrypt/decrypt`) を提供します。
- **7 メソッドすべてで、iframe の中でのユーザーの承認が必要です。`getPublicKey` も例外ではありません。**
  - `getPublicKey` と `getRelays` の承認は NIP-07 拡張機能の初回接続と同じく、オリジン単位の*接続の承認*として扱われます。
  - ダイアログには「今回のみ許可」「常に許可」「拒否」のボタンがあります (英語の UI では "Allow once"、"Always allow"、"Reject")。「常に許可」はオリジンごと、種類ごとに記憶されます。種類は接続 (`getPublicKey` / `getRelays`)、`signEvent`、NIP-44、NIP-04 の 4 つです。接続を常に許可しても、署名は許可されません。
  - 復号では「常に許可」が出ないため、ユーザーがその種類を「拒否」に設定していない限り (次の項目を参照)、毎回ダイアログが表示されます。
  - nosskey.app の設定では、ユーザーが種類ごとに、すべてのサイトに対して「常に許可」か「拒否」を選ぶこともできます。既定は毎回確認なので、どちらであるとも決めつけないでください。「拒否」のときは、ダイアログを出さずに `USER_REJECTED` で拒否されます。
  - 例外として、iframe がまだ鍵を読めないときの `getRelays` は、ダイアログなしで `{}` を返します。ストレージアクセスが未許可の場合も含むので、`{}` を「ユーザーにリレー設定がない」と扱わないでください。
- iframe は自分で開いて閉じます。どのリクエストの処理中も、ホストが `nosskey:visibility` を送り、client が `client.iframe.style.display` を `block` と `none` で切り替えます。「常に許可」で自動承認されるリクエストでも同じで、その場合は iframe が一瞬表示されます。**iframe をどこに、どの大きさで置くかはアプリが決めます。**
- リクエストの timeout は既定で 60 秒です (`timeout` オプション)。短くしないでください。ホストはストレージアクセスの許可を最大 60 秒待ちますし、ユーザーにはダイアログとパスキーのプロンプトを操作する時間が要ります。長くするのは問題ありません。
  - client のタイマーのほうが先に始まります。そのため、ユーザーがストレージアクセスのプロンプトを放置すると、呼び出しは `NO_KEY` ではなく timeout の `Error` で reject されることがあります。
  - ホストの承認ダイアログには timeout がありません。client が timeout した後もダイアログは開いたままで、後から承認すると処理は実行されますが、結果は捨てられます。timeout は「リクエストがタイムアウトしました。もう一度試してください」と表示してください。古いダイアログが開いたままなら、ユーザーに先に閉じてもらいます。新しいリクエストはその後ろで待たされるためです。
- `client.ready()` は、iframe が `nosskey:ready` を送ると解決します。**`ready()` 自体には timeout がありません。**
- エラーは `code` を持つ `NosskeyIframeError` で reject されます。
  | code | 意味 | アプリがすること |
  |---|---|---|
  | `NO_KEY` | ユーザーがまだ Nosskey のパスキーを持っていないか、ストレージアクセスが許可されなかった | `https://nosskey.app` へのリンクを出す (「そこでパスキーを作ってから戻ってきてください」) |
  | `USER_REJECTED` | ユーザーがダイアログで拒否したか、その種類を「拒否」に設定している | 「リクエストが拒否されました」と出す。自動で再試行しない |
  | `RATE_LIMITED` | 自分のオリジンからの失敗が 5 回続いたため、60 秒間ブロックされている。拒否に加え、鍵を回復できずに失敗したリクエストも数える (たとえば、パスキーがないまま「Nosskey でログイン」を押した場合) | 「しばらくしてから試してください」と出す。決して自動で再試行しない |
  | `NOT_AUTHORIZED` / `UNKNOWN_METHOD` / `INVALID_REQUEST` / `INTERNAL` | 不具合か環境の問題 | メッセージをそのまま出す |

  timeout のときは、ただの `Error` で reject されます。
- ブラウザの対応: ほとんどのブラウザは Nosskey でのログインに対応していますが、代わりのログイン手段を必ず残してください。
- ストレージ分離: クロスオリジンの iframe では、ブラウザが `localStorage` を分離します。ホストは Storage Access API で鍵を回復し、ユーザーは iframe の中で一度「許可」をクリックする必要があります。ブラウザはこの許可を **iframe のドキュメント単位**で保持します。下のルール R1 と R2 があるのはこのためです。
- iframe は、リクエストがなくても**自分から**開くことがあります。鍵が見つからず、待っても回復しないときです。具体的には、ストレージアクセスは許可済みだが鍵がない場合と、ブラウザに Storage Access API がない場合です。そのときは、nosskey.app へのリンクと閉じるボタンのあるカードを表示します。この判定は iframe のマウント時と、**タブが再び表示されるたびに**行われます。アプリの不具合ではなく、想定どおりの動作です。

## 3. ルール (MUST / MUST NOT)

- **R1. client は、それが必要になる最初のユーザー操作で遅延生成すること** (Nosskey のログインのクリックや、復元した Nosskey セッションでの最初の署名操作)。ページの読み込み時には作らないでください。鍵のないブラウザでは、マウントした直後に iframe が自分から開くことがあるためです (§2)。
- **R2. client はページごとに一度だけ作り、作り直さないこと。** モジュールレベルのシングルトンとして保持します。ログアウト、`visibilitychange`、フォーカスの変化、ルートの変更で `destroy()` を呼ばないでください。作り直すと Storage Access の許可が失われ、ユーザーはもう一度許可することになります。`destroy()` を呼ぶのは、アプリ全体を終了するときと、初期化に失敗したときだけです。
- **R3. ユーザーの操作なしに `getPublicKey()` / `getRelays()` を呼ばないこと。** ページの読み込み時、`visibilitychange`、タイマーのいずれでも呼びません。呼ぶたびに承認ダイアログやストレージアクセスのプロンプトが開く可能性があり、拒否は `RATE_LIMITED` に数えられます。
  - セッションは自前のストレージから復元します。ログイン時に `{ method, pubkey }` を保存してください。
  - ホストはリクエストのたびに現在のアカウントを読み直すので、ポーリングは不要です。
- **R4. iframe は画面全体を覆う固定のオーバーレイにマウントすること。** `z-index` は、ログインモーダルを含むアプリのどのモーダルよりも上にします。オーバーレイの背景は `MutationObserver` で iframe の `style.display` に合わせて切り替えます。`message` イベントを直接購読しないでください。client はメッセージのオリジンと送信元を検証済みですが、直接の購読ではそれが行われません。
  - ログインモーダルを、ネイティブの `<dialog>.showModal()` で開かないでください。モーダル表示の dialog はブラウザのトップレイヤーに置かれるため、どの `z-index` でもオーバーレイをその上に出せません。さらに dialog の外側はすべて操作できなくなり、Nosskey の iframe も操作できません。§8 のように、`position` を指定した通常の要素でログインモーダルを作ってください。
- **R5. NIP-07 ログインも提供する場合は、`window.nostr` を上書きしないこと。** すべての署名はログイン方法に応じて選ぶ小さな `Signer` の抽象化を通します。唯一の例外は §8 を参照してください。
- **R6. ブラウザでのみ動かすこと。** SSR のフレームワーク (SvelteKit、Next.js、Nuxt) では、このコードはクライアント側でだけ import して呼び出し、先に `typeof window !== 'undefined'` を確かめます。
- **R7. 必要なメソッドだけを使うこと。** アプリに DM がなければ、`nip04` / `nip44` はつながないでください。
- **R8.** アプリが Content-Security-Policy を設定しているなら、`frame-src https://nosskey.app` を加えます。`Permissions-Policy` ヘッダーを送っているなら、`https://nosskey.app` に対して `publickey-credentials-get` と `publickey-credentials-create` を許可する必要があります。許可しないと、iframe の中でパスキーが動きません。
- **R9. `signEvent()` には、`pubkey`・`id`・`sig` を含まない署名前のイベントを渡すこと。** 署名する側 (signer) は、受け取ったこれらのフィールドをそのまま残します。`pubkey` を入れておくと、アカウントの切り替え後に不正な署名のイベントができ、§7 の確認でも見つけられません。§7 の `getSigner()` のコードがこれらのフィールドを取り除きます。

## 4. インストール

```sh
npm install nosskey-iframe
```

## 5. iframe の client のシングルトン (`src/lib/nosskey.ts`)

```ts
import { NosskeyIframeClient } from 'nosskey-iframe';

const NOSSKEY_IFRAME_URL = 'https://nosskey.app/#/iframe';
// ready() has no timeout of its own. The host may delay readiness by up to 5 s
// while it resolves storage, so allow for that plus the page load.
const READY_TIMEOUT_MS = 15_000;

let clientPromise: Promise<NosskeyIframeClient> | null = null;

/** Lazily mount the Nosskey iframe once per page (rules R1/R2). */
export function getNosskeyClient(): Promise<NosskeyIframeClient> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Nosskey is only available in the browser'));
  }
  clientPromise ??= createClient().catch((err) => {
    clientPromise = null; // let a later click retry
    throw err;
  });
  return clientPromise;
}

async function createClient(): Promise<NosskeyIframeClient> {
  const overlay = document.createElement('div');
  overlay.className = 'nosskey-overlay';
  document.body.appendChild(overlay);

  const client = new NosskeyIframeClient({
    iframeUrl: NOSSKEY_IFRAME_URL,
    container: overlay,
    // In embedded mode the iframe page is transparent, so the iframe's CSS
    // background (§6) shows through. Use a fixed theme that matches that
    // background: 'neutral-light' / 'purple-light' with #fff, 'neutral-dark'
    // with #141414, 'purple-dark' with #131318. Applied at load time only.
    theme: 'neutral-light',
    lang: 'auto', // or 'ja' | 'en'
  });

  // The client toggles iframe.style.display; mirror that onto the backdrop.
  const observer = new MutationObserver(() => {
    overlay.classList.toggle('visible', client.iframe.style.display !== 'none');
  });
  observer.observe(client.iframe, { attributes: true, attributeFilter: ['style'] });

  try {
    await withTimeout(client.ready(), READY_TIMEOUT_MS);
    return client;
  } catch (err) {
    // Never became ready, so there is no grant to keep; clean up and allow a retry.
    observer.disconnect();
    client.destroy();
    overlay.remove();
    throw err;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Nosskey iframe did not load')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
```

## 6. オーバーレイの CSS (グローバルのスタイルシート)

```css
.nosskey-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000; /* above every app modal, including your login modal */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  pointer-events: none; /* hidden state must not block the page */
  background: transparent;
}
.nosskey-overlay.visible {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.45);
}
.nosskey-overlay iframe {
  width: min(420px, 100%);
  height: min(560px, 90vh); /* the approval dialog needs this much room */
  border: 0;
  border-radius: 12px;
  background: #fff; /* must match the `theme` you passed (see §5) */
  pointer-events: auto;
}
```

フレームワークがコンポーネント単位でスタイルを閉じ込める場合 (Svelte、Vue、CSS modules) は、この CSS をグローバルのスタイルシートに置きます。オーバーレイはどのコンポーネントにも属さない場所に作られるためです。

アプリがライトとダークを切り替える場合は、client を作るときにテーマを選び、同時に対応する iframe の背景色を設定します。`theme: 'auto'` は iframe の中で解決されるため、固定の CSS の背景色はそれに追従しません。

## 7. 認証と `Signer` (`src/lib/auth.ts`)

ログインのロジックはフレームワークに依存しません。状態は使っているフレームワークのストアで包んでください (Svelte の `$state` / `writable`、React の context や zustand、Vue の `ref`)。このコードでは Nosskey 以外のログイン手段として NIP-07 を使っています。NIP-07 ログインがないアプリでは `nip07` の分岐を外し、ほかの手段があるアプリではその手段の `Signer` を `getSigner()` に加えてください。

```ts
import { NosskeyIframeError, type NostrEvent } from 'nosskey-iframe';
import { getNosskeyClient } from './nosskey';

export type LoginMethod = 'nip07' | 'nosskey';
export interface Session {
  method: LoginMethod;
  pubkey: string; // hex
}

/** The signing surface the rest of the app uses. Never call window.nostr directly. */
export interface Signer {
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<NostrEvent>;
}

// Skip this if the project already declares `window.nostr`; reuse that type instead.
declare global {
  interface Window {
    nostr?: Signer;
  }
}

const SESSION_KEY = 'myapp:session'; // rename per app
const HEX_PUBKEY = /^[0-9a-f]{64}$/;

export function loadSession(): Session | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return s && (s.method === 'nip07' || s.method === 'nosskey') && HEX_PUBKEY.test(s.pubkey)
      ? s
      : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

/** Check when the login modal opens: extensions may inject window.nostr after load. */
export function hasNip07Extension(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

export async function loginWithNip07(): Promise<Session> {
  if (!window.nostr) throw new Error('No NIP-07 extension found');
  const session: Session = { method: 'nip07', pubkey: await window.nostr.getPublicKey() };
  saveSession(session);
  return session;
}

/** Call only from a click handler (rule R3). */
export async function loginWithNosskey(): Promise<Session> {
  const client = await getNosskeyClient();
  const session: Session = { method: 'nosskey', pubkey: await client.getPublicKey() };
  saveSession(session);
  return session;
}

/** Forget the session locally. Keep the iframe alive (rule R2). */
export function logout(): void {
  saveSession(null);
}

/** Rule R9: the signer keeps a preset pubkey/id/sig, so never pass them in. */
export function toUnsigned(event: NostrEvent): NostrEvent {
  const { pubkey: _pubkey, id: _id, sig: _sig, ...unsigned } = event;
  return unsigned;
}

export async function getSigner(session: Session): Promise<Signer> {
  if (session.method === 'nosskey') {
    const client = await getNosskeyClient();
    return {
      // Answer from the session: asking the iframe could show a dialog nobody asked for.
      getPublicKey: async () => session.pubkey,
      signEvent: (event) => client.signEvent(toUnsigned(event)),
    };
  }
  const nostr = window.nostr;
  if (!nostr) throw new Error('No NIP-07 extension found');
  return {
    getPublicKey: () => nostr.getPublicKey(),
    signEvent: (event) => nostr.signEvent(toUnsigned(event)),
  };
}

/** Map login and signing errors to a message for the user. */
export function describeError(err: unknown): { message: string; showNosskeyLink: boolean } {
  if (err instanceof NosskeyIframeError) {
    switch (err.code) {
      case 'NO_KEY':
        return {
          message: 'No Nosskey passkey found. Create one at nosskey.app, then try again.',
          showNosskeyLink: true,
        };
      case 'USER_REJECTED':
        return { message: 'The request was declined.', showNosskeyLink: false };
      case 'RATE_LIMITED':
        return { message: 'Too many failed requests. Try again in a minute.', showNosskeyLink: false };
    }
  }
  // Only the client's own timeout. A cancelled passkey prompt arrives as INTERNAL and its
  // browser message can also say "timed out", so do not match NosskeyIframeError here.
  if (err instanceof Error && err.message.startsWith('Nosskey iframe request timed out')) {
    return { message: 'The request timed out. Please try again.', showNosskeyLink: false };
  }
  return { message: err instanceof Error ? err.message : String(err), showNosskeyLink: false };
}
```

署名したら、ログイン中のアカウントで署名されたイベントが返ってきたかを確かめてください。こうすると、ユーザーが nosskey.app でアカウントを切り替えたことに、ポーリングなしで気づけます。この確認が成り立つのは、`getSigner()` が `pubkey` を含めずにイベントを送るからです (ルール R9)。

```ts
const signed = await signer.signEvent(unsigned);
if (signed.pubkey !== session.pubkey) {
  // Switched at nosskey.app. Either adopt signed.pubkey as the new session
  // (re-save it) or discard the event and ask the user to log in again.
}
```

## 8. ログインモーダル: NIP-07 と Nosskey を並べる

yakitofu の `LoginModal.svelte` にならった構成です。この例では Nosskey と並べる手段として NIP-07 を使っています。ほかのログイン手段があるアプリでは、同じモーダルに並べてください。次の要件はどのフレームワークにも当てはまります。

- アプリの既存のログインボタンと並べて、「Nosskey でログイン (パスキー)」(下のコードでは `Log in with Nosskey (passkey)`) のボタンを置きます。このボタンは常に有効にし、「nosskey.app に保存したパスキーを使います。」のような 1 行の説明を添えます。
- 例では、もう一方のボタンは「ブラウザ拡張機能でログイン (NIP-07)」(同じく `Log in with browser extension (NIP-07)`) です。`hasNip07Extension()` が false のときは**無効**にし、その下に短い説明を添えます。
- `loginWithNosskey()` とほかのログイン関数は、**クリックハンドラーの中で直接**呼びます (ルール R3)。
- ログインの処理中は、すべてのログインボタンを無効にし、Escape や背景のクリックでモーダルを閉じないでください。Nosskey のオーバーレイはモーダルの上に開きますが、それで正常です。
- エラーのときは `describeError(err).message` を表示します。`showNosskeyLink` が true なら、`target="_blank" rel="noopener noreferrer"` を付けた `https://nosskey.app` へのリンクを加えます。
- 成功したら、`Session` をアプリの状態に保存し、モーダルを閉じます。

Svelte 5 の例です。`$lib` は SvelteKit のエイリアスなので、素の Svelte + Vite のアプリでは相対パスで import してください。

```svelte
<script lang="ts">
  import { describeError, hasNip07Extension, loginWithNip07, loginWithNosskey, type Session } from '$lib/auth';

  let { open = $bindable(false), onLoggedIn }: { open?: boolean; onLoggedIn: (s: Session) => void } = $props();

  let loading = $state<'nip07' | 'nosskey' | null>(null);
  let error = $state<{ message: string; showNosskeyLink: boolean } | null>(null);
  const hasExtension = $derived(open && hasNip07Extension());

  async function login(method: 'nip07' | 'nosskey') {
    loading = method;
    error = null;
    try {
      const session = method === 'nip07' ? await loginWithNip07() : await loginWithNosskey();
      open = false;
      onLoggedIn(session);
    } catch (err) {
      error = describeError(err);
    } finally {
      loading = null;
    }
  }

  function close() {
    if (!loading) open = false;
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && close()} />

{#if open}
  <div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && close()}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <h2 id="login-title">Log in</h2>

      <button onclick={() => login('nip07')} disabled={!hasExtension || loading !== null}>
        {loading === 'nip07' ? '…' : 'Log in with browser extension (NIP-07)'}
      </button>
      {#if !hasExtension}<p class="hint">No NIP-07 extension detected.</p>{/if}

      <button onclick={() => login('nosskey')} disabled={loading !== null}>
        {loading === 'nosskey' ? '…' : 'Log in with Nosskey (passkey)'}
      </button>
      <p class="hint">Uses a passkey stored at nosskey.app.</p>

      {#if error}
        <p class="error" role="alert">
          {error.message}
          {#if error.showNosskeyLink}
            <a href="https://nosskey.app" target="_blank" rel="noopener noreferrer">Open nosskey.app</a>
          {/if}
        </p>
      {/if}

      <button onclick={close} disabled={loading !== null}>Cancel</button>
    </div>
  </div>
{/if}
```

### 任意: 外部の埋め込み向けに `window.nostr` を公開する

アプリが自分で `window.nostr` を探す埋め込みウィジェットを載せている場合だけ行います。combine は埋め込みの投稿画面のために [`nip07.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/nip07.ts) でこれを行っています。combine には NIP-07 ログインがないため、shim を無条件に組み込んでいます。NIP-07 ログインも提供するアプリは、次の点で combine と変える必要があります。

- shim は Nosskey でログインした後にだけ組み込みます。それまであった provider は保持しておき、ログアウト時に元に戻します。誰もログインしていない間と、NIP-07 でログインした後は、拡張機能の `window.nostr` がそのまま残ります。
- 公開するのは、`getPublicKey` (セッションから答える)、`signEvent` (`toUnsigned` を通す、R9)、`getRelays` だけにします。

## 9. 確認

プロジェクトの lint、型チェック、テスト、ビルドを実行します。そのうえで、Chromium ブラウザで次を確かめます。できれば Safari / iOS でも同じ手順を試してください。Safari は Chromium と挙動が一部異なります (ストレージアクセスの許可にユーザーのタップが要るなど)。

1. 別のタブで `https://nosskey.app` を開き、パスキーを作ります。
2. アプリで「Nosskey でログイン」をクリックします。iframe のオーバーレイが開きます。iframe がストレージアクセスを求めたら先に許可し、接続を承認します。アプリに表示された pubkey (npub) が nosskey.app のものと一致することを確かめます。
3. ページを再読み込みします。ログインしたままで、iframe もダイアログも**出ない**はずです。
4. 何か投稿します。承認ダイアログが出て、公開されたイベントの `pubkey` がセッションと一致するはずです。
5. タブを何度か切り替えます。ダイアログもストレージアクセスのプロンプトも出ないはずです。
6. ログアウトしてから、もう一度ログインします。ストレージアクセスを再び求められないはずです。
7. Nosskey のパスキーがないブラウザプロファイルを使います。ログインが「nosskey.app でパスキーを作ってください」のメッセージで終わり、オーバーレイが閉じることを確かめます。ブラウザの状態によって、次のどちらかになります。
   - 待っても回復しないと iframe が判断できる場合 (ストレージアクセスが許可済みか、ブラウザに Storage Access API がない) は、`NO_KEY` がすぐに返り、カードは一瞬表示されるだけです。
   - それ以外の場合は、iframe がストレージアクセスのカードを出して待ちます。ユーザーが許可するかカードを閉じると、ログインは失敗します。誰もカードに触れなければ、60 秒後に timeout のメッセージで終わります。

## 10. トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| クリックしても何も起きず、`ready()` が解決しない | CSP の `frame-src` が nosskey.app を止めている (R8) か、ネットワークの問題。15 秒の ready の timeout でこれが表に出る |
| iframe は開くがクリックできない、またはモーダルの後ろに出る | オーバーレイの `z-index` が低いか、親要素に `pointer-events: none` がある (R4) |
| タブに戻るたびにストレージアクセスを求められる | client を破棄したり作り直したりしている (R2) |
| ページの読み込み時やタブの切り替え時に承認ダイアログが出る | どこかがユーザーの操作なしに `getPublicKey()` / `getRelays()` を呼んでいる (R3) |
| 「鍵がない」カード (nosskey.app へのリンク付き) が勝手に出る。タブの切り替え後にも出る | iframe がマウントされていて鍵を見つけられないときの想定どおりの動作 (§2)。ユーザーは閉じられる。遅延生成 (R1) にすれば、Nosskey を選んでいないユーザーには出ない |
| ログインモーダルを開いている間、オーバーレイは開くが iframe をクリックできない | ログインモーダルが `<dialog>.showModal()` を使っている (R4) |
| ユーザーがパスキーを作った直後に `NO_KEY` になる | 別のブラウザやプロファイルで作ったか、ストレージアクセスのプロンプトを閉じた。もう一度ログインをクリックする |
| `RATE_LIMITED` | 拒否か鍵の回復の失敗が 5 回続いた (例: パスキーがないままログインを何度もクリックした)。60 秒待ち、自動の再試行をやめる |
| 署名のたびに画面が白く光る | 想定どおりの動作。iframe はリクエストのたびに開く。iframe の `background` と `theme` をアプリに合わせる |

## さらに詳しく

- 人間向けの統合ガイド: [ja](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/ja/iframe-integration.ja.md) / [en](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/en/iframe-integration.en.md)
- `nosskey-iframe` パッケージの README: [ja](https://github.com/ocknamo/nosskey-sdk/blob/main/packages/nosskey-iframe/README.ja.md) / [en](https://github.com/ocknamo/nosskey-sdk/blob/main/packages/nosskey-iframe/README.md)
- ホストの内部構造: [iframe-host.ja.md](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/ja/iframe-host.ja.md)
- Vanilla TypeScript のデモ: [`examples/parent-sample`](https://github.com/ocknamo/nosskey-sdk/tree/main/examples/parent-sample) (https://ocknamo.github.io/nosskey-sdk/ で公開中)
