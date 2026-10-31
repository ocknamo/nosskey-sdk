# Add "Log in with Nosskey" (passkey) to a Nostr web client

> Instructions for AI coding agents. Follow them to add passkey login to an existing
> Nostr web client by embedding the hosted Nosskey signing iframe
> (`https://nosskey.app/#/iframe`) through the `nosskey-iframe` npm package.
>
> Checked against `nosskey-iframe` 0.2.0 and the reference host running at nosskey.app.
>
> A Japanese version with the same content is at [`nosskey-iframe-login.ja.md`](./nosskey-iframe-login.ja.md).

<!-- Maintainers: this English file is the source of truth, and nosskey-iframe-login.ja.md is its
translation. Change this file first, then update the Japanese one to match. Keep the code blocks identical
in both files. -->

Reference implementations (production apps by the Nosskey author):

- **combine** (Svelte 5): the most heavily used integration. See
  [`src/lib/auth.svelte.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/auth.svelte.ts),
  [`src/lib/nip07.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/nip07.ts) and
  [`src/app.css`](https://github.com/ocknamo/combine/blob/main/src/app.css) (`.nosskey-overlay`).
- **yakitofu** (SvelteKit): a login modal that offers NIP-07 and Nosskey side by side. See
  [`src/lib/components/LoginModal.svelte`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/components/LoginModal.svelte),
  [`src/lib/services/nosskey.ts`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/services/nosskey.ts) and
  [`src/lib/services/signer.ts`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/services/signer.ts).

**Copy only the overlay, the `MutationObserver`, the lazy singleton and the login modal layout from
these apps.** Both apps break rules in §3, and this guide wins wherever they differ:

- combine calls `getPublicKey()` on every `visibilitychange` (`reconcileSession`), and calls
  `getRelays()` at startup (`refreshRelays` in `App.svelte`). Both break R3.
- combine installs its `window.nostr` shim unconditionally, because it has no NIP-07 login. That
  breaks R5 for apps that also offer NIP-07 login.
- yakitofu calls `destroy()` on logout, which breaks R2. Its signer also asks the iframe for
  `getPublicKey()` instead of answering from the session.

---

## 1. What you are building

- The client app adds a login option, "Log in with Nosskey".
- When the user picks it, the app mounts a hidden cross-origin iframe from `nosskey.app`. It then
  calls `getPublicKey()` through `postMessage`.
- `nosskey.app` shows its own dialog inside the iframe. Depending on the browser state, this is
  either a connection approval or a storage-access prompt. Once the user approves, the app
  receives the user's pubkey.
- Later, `signEvent()` goes through the same iframe. `nosskey.app` asks for approval and derives
  the key from the user's passkey (WebAuthn PRF).

Trade-off to tell the user about: the passkey belongs to `nosskey.app` (the WebAuthn RP is
`nosskey.app`). The user's identity therefore depends on nosskey.app being online.

## 2. Facts about the API (do not guess these)

- Package: `nosskey-iframe`. The client side has no runtime dependencies. `nosskey-sdk` is an
  optional peer dependency that only a self-hosted signer needs. Import types such as `NostrEvent`
  from `nosskey-iframe`.
- Iframe URL: `https://nosskey.app/#/iframe`. It accepts any parent origin, so no registration is needed.
- The client exposes all 7 NIP-07 methods: `getPublicKey`, `getRelays`, `signEvent`,
  `nip44.encrypt/decrypt` and `nip04.encrypt/decrypt`.
- **All 7 methods require user approval in the iframe, `getPublicKey` included.**
  - `getPublicKey` and `getRelays` count as a per-origin *connection approval*, like the first
    connect in a NIP-07 extension.
  - The dialog has "Allow once", "Always allow" and "Reject" buttons (「今回のみ許可」「常に許可」
    「拒否」 in the Japanese UI). "Always allow" is remembered per origin and per category. The four
    categories are connect (`getPublicKey` / `getRelays`), `signEvent`, NIP-44 and NIP-04. Always
    allowing connect does not allow signing.
  - Decryption never offers "Always allow", so it shows the dialog every time unless the user set
    that category to "Deny" (see the next point).
  - In nosskey.app's settings, the user can also set a category to "Always allow" or "Deny"
    (「常に許可」「拒否」) for every site. The default is "Ask every time" (「毎回確認」), so do not
    assume either. "Deny" rejects with `USER_REJECTED`
    without showing a dialog.
  - Exception: `getRelays` returns `{}` without a dialog when the iframe cannot read a key yet. That
    includes storage access not being granted, so do not treat `{}` as "the user has no relays".
- The iframe opens and closes itself. During any request, the host sends `nosskey:visibility`, and
  the client toggles `client.iframe.style.display` between `block` and `none`. This happens even
  when the request is auto-approved through "Always allow", in which case the iframe flashes briefly. **Your app
  controls where the iframe sits and how large it is.**
- Request timeout: 60 s by default (`timeout` option). Do not lower it: the host waits up to 60 s
  for the user to grant storage access, and the user needs time for the dialog and the passkey
  prompt. Raising it is safe.
  - The client's timer starts first. If the user lets a storage-access prompt sit, the call can
    therefore reject with the timeout `Error` instead of `NO_KEY`.
  - The host's approval dialog has no timeout. After a client timeout it stays open, and approving
    it later runs the operation, but the result is dropped. Show the timeout as "the request timed
    out, try again". If the old dialog is still open, the user should close it first: a new
    request waits behind it.
- `client.ready()` resolves once the iframe sends `nosskey:ready`. It has **no timeout of its own**.
- Errors reject with `NosskeyIframeError` and a `code`:
  | code | meaning | what the app should do |
  |---|---|---|
  | `NO_KEY` | The user has no Nosskey passkey yet, or storage access was not granted | Show a link to `https://nosskey.app` ("create a passkey there, then come back") |
  | `USER_REJECTED` | The user declined in the dialog, or set that category to "Deny" | Show "request was declined". Do not retry automatically |
  | `RATE_LIMITED` | 5 failures in a row from your origin; blocked for 60 s. Declines count, and so does every request that fails because no key could be recovered (for example, clicking "Log in with Nosskey" without a passkey) | Show "try again later". Never retry automatically |
  | `NOT_AUTHORIZED` / `UNKNOWN_METHOD` / `INVALID_REQUEST` / `INTERNAL` | Bug or environment problem | Show the message |

  A timeout rejects with a plain `Error`.
- Browser support: most browsers support Nosskey login, but always keep another login method available.
- Storage partitioning: in a cross-origin iframe, browsers partition `localStorage`. The host
  recovers the key with the Storage Access API, and the user has to click "Grant storage access"
  (「ストレージアクセスを許可」) inside the iframe once. The browser keeps that grant **for the iframe document**, which is why
  rule R2 below exists.
- The iframe can also open **by itself**, without any request. This happens when it cannot find a
  key and waiting would not help: storage access was granted but there is no key, or the browser has
  no Storage Access API. It then shows a card that links to nosskey.app and has a close button. The
  check runs when the iframe mounts **and every time the tab becomes visible again**. This is
  expected behaviour, not a bug in your app.

## 3. Rules (MUST / MUST NOT)

- **R1. Create the client lazily, on the first user action that needs it** (the Nosskey login
  click, or the first signing action of a restored Nosskey session). Do not create it at page
  load, because a keyless browser may open the iframe on its own right after it mounts (§2).
- **R2. Create the client once per page and never recreate it.** Keep it as a module-level
  singleton. Do not call `destroy()` on logout, `visibilitychange`, focus changes or route changes.
  Recreating it throws away the Storage Access grant, and the user has to approve again.
  Call `destroy()` only on full app teardown, or when initialization failed.
- **R3. Never call `getPublicKey()` / `getRelays()` without a user action.** That means not on
  page load, not on `visibilitychange`, and not on a timer. Each call can open the approval dialog
  or the storage-access prompt, and declines count toward `RATE_LIMITED`.
  - Restore sessions from your own storage: save `{ method, pubkey }` at login.
  - The host re-reads the current account on every request, so you never need to poll it.
- **R4. Mount the iframe in a fixed full-screen overlay** with a `z-index` above every app
  modal, your login modal included. Sync the overlay's backdrop to the iframe's
  `style.display` with a `MutationObserver`. Do not listen to raw `message` events: the client
  already checks the origin and source of messages, and a raw listener would not.
  - Do not open your login modal with the native `<dialog>.showModal()`. A modal dialog sits in the
    browser's top layer, so no `z-index` can put the overlay above it, and everything outside the
    dialog becomes inert, the Nosskey iframe included. Build the login modal from an ordinary
    positioned element, as in §8.
- **R5. Do not overwrite `window.nostr`** when you offer NIP-07 login too. Route all signing
  through a small `Signer` abstraction chosen by the login method. See §8 for the one exception.
- **R6. Browser only.** In SSR frameworks (SvelteKit, Next.js, Nuxt), import and call this code
  only on the client, and check `typeof window !== 'undefined'` first.
- **R7. Use only the methods you need.** If the app has no DMs, do not wire up `nip04` / `nip44`.
- **R8.** If the app sets a Content-Security-Policy, add `frame-src https://nosskey.app`. If it
  sends a `Permissions-Policy` header, it must allow `publickey-credentials-get` and
  `publickey-credentials-create` for `https://nosskey.app`, or passkeys will not work in the iframe.
- **R9. Pass unsigned events to `signEvent()`: no `pubkey`, `id` or `sig`.** The signer keeps
  any of these fields it receives. A preset `pubkey` produces an invalidly signed event after an
  account switch, and the check in §7 then cannot catch it. The `getSigner()` code in §7 strips
  these fields for you.

## 4. Install

```sh
npm install nosskey-iframe
```

## 5. Iframe client singleton — `src/lib/nosskey.ts`

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

## 6. Overlay CSS (global stylesheet)

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

If a framework scopes styles per component (Svelte, Vue, CSS modules), put this CSS in the global
stylesheet. The overlay is created outside every component.

If the app switches between light and dark, pick the theme when the client is created, and set the
matching iframe background at the same time. `theme: 'auto'` is resolved inside the iframe, and a
fixed CSS background will not follow it.

## 7. Auth and signer — `src/lib/auth.ts`

The login logic does not depend on a framework. Wrap the state in your framework's store
(Svelte `$state` / `writable`, a React context or zustand, Vue `ref`). The code uses NIP-07 as
the other login method. If the app has no NIP-07 login, drop the `nip07` branches; if it has
other methods, add their own `Signer` in `getSigner()`.

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

When you sign, check that the event came back signed by the logged-in account. This is how the
app notices that the user switched accounts at nosskey.app, without any polling. The check only
works because `getSigner()` sends the event without a `pubkey` (rule R9):

```ts
const signed = await signer.signEvent(unsigned);
if (signed.pubkey !== session.pubkey) {
  // Switched at nosskey.app. Either adopt signed.pubkey as the new session
  // (re-save it) or discard the event and ask the user to log in again.
}
```

## 8. Login modal: NIP-07 and Nosskey side by side

This follows yakitofu's `LoginModal.svelte`. If the app has other login methods, offer them in the
same modal. The requirements apply to any framework:

- Add a "Log in with Nosskey (passkey)" button next to the app's existing login buttons. Keep it
  always enabled, with a one-line explanation such as "Uses a passkey stored at nosskey.app."
- In the example, the other button is "Log in with browser extension (NIP-07)". It is
  **disabled** when `hasNip07Extension()` returns false, with a short hint underneath.
- Call `loginWithNosskey()` (and the other login functions) **directly in the click handler**
  (rule R3).
- While a login is running, disable every login button and do not close the modal on Escape or
  on a backdrop click. The Nosskey overlay opens on top of your modal; that is expected.
- On error, show `describeError(err).message`. If `showNosskeyLink` is true, add a link to
  `https://nosskey.app` with `target="_blank" rel="noopener noreferrer"`.
- On success, store the `Session` in your app state and close the modal.

Svelte 5 example. `$lib` is a SvelteKit alias; in a plain Svelte + Vite app, use a relative import.

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

### Optional: exposing `window.nostr` for third-party embeds

Do this only if the app hosts embedded widgets that look for `window.nostr` themselves.
combine does this for an embedded composer in
[`nip07.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/nip07.ts). An app that also
offers NIP-07 login must differ from combine as follows:

- Install the shim after a Nosskey login, and only then. Keep the provider that was there before,
  and put it back on logout. While nobody is logged in, or after a NIP-07 login, the extension's
  own `window.nostr` stays in place.
- Expose only `getPublicKey` (answered from the session), `signEvent` (through `toUnsigned`, R9)
  and `getRelays`.

## 9. Verify

Run the project's own lint, typecheck, tests and build. Then check in a Chromium browser. If you
can, repeat the steps on Safari / iOS too: it behaves differently from Chromium in parts (for
example, granting storage access needs a user tap).

1. Create a passkey at `https://nosskey.app` in a separate tab.
2. In your app, click "Log in with Nosskey". The iframe overlay opens. Approve the connection,
   allowing storage access first if the iframe asks for it. Check that the pubkey (npub) shown in
   the app matches nosskey.app.
3. Reload the page. You should still be logged in, and **no** iframe or dialog should appear.
4. Post something. The approval dialog appears, and the published event's `pubkey` matches the
   session.
5. Switch tabs back and forth. No dialog or storage prompt should appear.
6. Log out, then log in again. Storage access should not be requested a second time.
7. Use a browser profile with no Nosskey passkey. Login must end with the "create a passkey at
   nosskey.app" message, and the overlay must close. Depending on the browser state, this happens
   in one of two ways:
   - When waiting would not help (§2), `NO_KEY` comes back at once, and the card only flashes.
   - Otherwise the iframe shows a storage-access card and waits. Login fails after the user
     grants access or closes the card. If nobody touches the card, the call ends with the timeout
     message after 60 s instead.

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Nothing happens on click and `ready()` never resolves | CSP `frame-src` blocks nosskey.app (R8), or the network fails. The 15 s ready timeout surfaces this |
| The iframe opens but cannot be clicked, or appears behind your modal | The overlay's `z-index` is too low, or a parent element has `pointer-events: none` (R4) |
| Storage access is requested every time the user returns to the tab | The client is being destroyed or recreated (R2) |
| An approval dialog appears on page load or tab switch | Something calls `getPublicKey()` / `getRelays()` without a user action (R3) |
| A "no key" card (with a link to nosskey.app) appears on its own, also after a tab switch | Expected when the iframe is mounted and cannot find a key (§2). The user can close it. Mounting lazily (R1) keeps it away from users who never chose Nosskey |
| The overlay opens but the iframe cannot be clicked while your login modal is open | The login modal uses `<dialog>.showModal()` (R4) |
| `NO_KEY` right after the user created a passkey | The user created it in a different browser or profile, or dismissed the storage-access prompt. Click login again |
| The page shows a white flash on every signature | Expected (§2). Match the iframe `background` and `theme` to your app (§6) |

## More detail

- Human-oriented integration guide: [ja](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/ja/iframe-integration.ja.md) / [en](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/en/iframe-integration.en.md)
- `nosskey-iframe` package README: [en](https://github.com/ocknamo/nosskey-sdk/blob/main/packages/nosskey-iframe/README.md)
- Host internals: [iframe-host.en.md](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/en/iframe-host.en.md)
- Vanilla TypeScript demo: [`examples/parent-sample`](https://github.com/ocknamo/nosskey-sdk/tree/main/examples/parent-sample) (live at https://ocknamo.github.io/nosskey-sdk/)
