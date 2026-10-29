# Add "Log in with Nosskey" (passkey) to a Nostr web client

> Instructions for AI coding agents. Follow them to add passkey login to an existing
> Nostr web client by embedding the hosted Nosskey signing iframe
> (`https://nosskey.app/#/iframe`) through the `nosskey-iframe` npm package. The
> result offers "Log in with Nosskey" next to the usual NIP-07 extension login.
> The private key never reaches the client app.
>
> Checked against `nosskey-iframe` 0.2.0 and the reference host running at nosskey.app.

Reference implementations (production apps by the Nosskey author):

- **combine** (Svelte 5): the most heavily used integration. See
  [`src/lib/auth.svelte.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/auth.svelte.ts),
  [`src/lib/nip07.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/nip07.ts) and
  [`src/app.css`](https://github.com/ocknamo/combine/blob/main/src/app.css) (`.nosskey-overlay`).
- **yakitofu** (SvelteKit): a login modal that offers NIP-07 and Nosskey side by side. See
  [`src/lib/components/LoginModal.svelte`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/components/LoginModal.svelte),
  [`src/lib/services/nosskey.ts`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/services/nosskey.ts) and
  [`src/lib/services/signer.ts`](https://github.com/ocknamo/yakitofu/blob/main/yakitofu-app/src/lib/services/signer.ts).

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

- Package: `nosskey-iframe`. The client side has no runtime dependencies.
- Iframe URL: `https://nosskey.app/#/iframe`. It accepts any parent origin, so no registration is needed.
- The client exposes all 7 NIP-07 methods: `getPublicKey`, `getRelays`, `signEvent`,
  `nip44.encrypt/decrypt` and `nip04.encrypt/decrypt`.
- **All 7 methods require user approval in the iframe, `getPublicKey` included.**
  - `getPublicKey` and `getRelays` count as a per-origin *connection approval*, like the first
    connect in a NIP-07 extension.
  - The dialog has an "always allow this site" checkbox. It is remembered per origin and per
    category: connect, sign, or encrypt. Approving "connect" does not approve signing.
  - Decryption is never auto-approved.
  - Exception: `getRelays` returns `{}` without a dialog when there is no key.
- The iframe opens and closes itself. During any request, the host sends `nosskey:visibility`, and
  the client toggles `client.iframe.style.display` between `block` and `none`. This happens even
  when the user ticked "always allow", in which case the iframe flashes briefly. **Your app
  controls where the iframe sits and how large it is.**
- Request timeout: 60 s by default (`timeout` option). Keep the default, because the host's
  storage-recovery wait is also capped at 60 s.
- `client.ready()` resolves once the iframe sends `nosskey:ready`. It has **no timeout of its own**.
- Errors reject with `NosskeyIframeError` and a `code`:
  | code | meaning | what the app should do |
  |---|---|---|
  | `NO_KEY` | The user has no Nosskey passkey yet, or storage access was not granted | Show a link to `https://nosskey.app` ("create a passkey there, then come back") |
  | `USER_REJECTED` | The user declined in the dialog | Show "request was declined". Do not retry automatically |
  | `RATE_LIMITED` | 5 declines in a row from your origin; blocked for 60 s | Show "try again later" |
  | `NOT_AUTHORIZED` / `UNKNOWN_METHOD` / `INVALID_REQUEST` / `INTERNAL` | Bug or environment problem | Show the message |
  A timeout rejects with a plain `Error`.
- Browser support: Chromium 118+ works best. Firefox and Safari/iOS have limited PRF support.
  Always keep NIP-07 login available as an alternative.
- Storage partitioning: in a cross-origin iframe, browsers partition `localStorage`. The host
  recovers the key with the Storage Access API, and the user has to click "Allow" inside the
  iframe once. The browser keeps that grant **for the iframe document**, which is why rules R1 and R2 below exist.

## 3. Rules (MUST / MUST NOT)

- **R1. Create the client lazily, on the first user action that needs it** (the Nosskey login
  click, or the first signing action of a restored Nosskey session). Do not create it at page
  load, because a keyless browser may open the iframe on its own right after it mounts.
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
- **R5. Do not overwrite `window.nostr`** when you offer NIP-07 login too. Route all signing
  through a small `Signer` abstraction chosen by the login method. See §8 for the one exception.
- **R6. Browser only.** In SSR frameworks (SvelteKit, Next.js, Nuxt), import and call this code
  only on the client, and check `typeof window !== 'undefined'` first.
- **R7. Use only the methods you need.** If the app has no DMs, do not wire up `nip04` / `nip44`.
- **R8.** If the app sets a Content-Security-Policy, add `frame-src https://nosskey.app`.

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
    // Pick the theme that matches your app: 'neutral-light' | 'neutral-dark'
    // | 'purple-light' | 'purple-dark' | 'auto'. Applied at load time only.
    theme: 'auto',
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
  background: #fff; /* match the `theme` you passed */
  pointer-events: auto;
}
```

If a framework scopes styles per component (Svelte, Vue, CSS modules), put this CSS in the global
stylesheet. The overlay is created outside every component.

## 7. Auth and signer — `src/lib/auth.ts`

The login logic does not depend on a framework. Wrap the state in your framework's store
(Svelte `$state` / `writable`, a React context or zustand, Vue `ref`).

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

export function loadSession(): Session | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return s && (s.method === 'nip07' || s.method === 'nosskey') && typeof s.pubkey === 'string'
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

export async function getSigner(session: Session): Promise<Signer> {
  if (session.method === 'nosskey') {
    const client = await getNosskeyClient();
    return {
      // Answer from the session: asking the iframe could show a dialog nobody asked for.
      getPublicKey: async () => session.pubkey,
      signEvent: (event) => client.signEvent(event),
    };
  }
  if (!window.nostr) throw new Error('No NIP-07 extension found');
  return window.nostr;
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
        return { message: 'Too many declined requests. Try again in a minute.', showNosskeyLink: false };
    }
  }
  return { message: err instanceof Error ? err.message : String(err), showNosskeyLink: false };
}
```

When you sign, check that the event came back signed by the logged-in account. This is how the
app notices that the user switched accounts at nosskey.app, without any polling:

```ts
const signed = await signer.signEvent(unsigned);
if (signed.pubkey !== session.pubkey) {
  // Switched at nosskey.app. Either adopt signed.pubkey as the new session
  // (re-save it) or discard the event and ask the user to log in again.
}
```

## 8. Login modal: NIP-07 and Nosskey side by side

This follows yakitofu's `LoginModal.svelte`. The requirements apply to any framework:

- Show two buttons. "Log in with browser extension (NIP-07)" is **disabled** when
  `hasNip07Extension()` returns false, with a short hint underneath. "Log in with Nosskey
  (passkey)" is always enabled, with a one-line explanation such as "Uses a passkey stored at
  nosskey.app. Your private key never leaves nosskey.app."
- Call `loginWithNip07()` / `loginWithNosskey()` **directly in the click handler** (rule R3).
- While a login is running, disable both buttons and do not close the modal on Escape or on a
  backdrop click. The Nosskey overlay opens on top of your modal; that is expected.
- On error, show `describeError(err).message`. If `showNosskeyLink` is true, add a link to
  `https://nosskey.app` with `target="_blank" rel="noopener noreferrer"`.
- On success, store the `Session` in your app state and close the modal.

Svelte 5 example:

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
      <p class="hint">Uses a passkey stored at nosskey.app. Your private key never leaves nosskey.app.</p>

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

Do this only if the app hosts embedded widgets that look for `window.nostr` themselves
(combine does it for an embedded composer). Follow
[combine's `nip07.ts`](https://github.com/ocknamo/combine/blob/main/src/lib/nip07.ts):

- Install the shim only for a Nosskey session.
- Expose only `getPublicKey` (answered from the session), `signEvent` and `getRelays`.
- When signed out, start a login from `getPublicKey` only if `navigator.userActivation.isActive`.
- Keep the previous provider and restore it on logout.

## 9. Verify

Run the project's own lint, typecheck, tests and build. Then check in a Chromium browser:

1. Create a passkey at `https://nosskey.app` in a separate tab.
2. In your app, click "Log in with Nosskey". The iframe overlay opens. Approve the connection,
   allowing storage access first if the iframe asks for it. Check that the pubkey (npub) shown in
   the app matches nosskey.app.
3. Reload the page. You should still be logged in, and **no** iframe or dialog should appear.
4. Post something. The approval dialog appears, and the published event's `pubkey` matches the
   session.
5. Switch tabs back and forth. No dialog or storage prompt should appear.
6. Log out, then log in again. Storage access should not be requested a second time.
7. Use a browser profile with no Nosskey passkey. Login should fail with the "create a passkey at
   nosskey.app" message, and the overlay should close.

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Nothing happens on click and `ready()` never resolves | CSP `frame-src` blocks nosskey.app (R8), or the network fails. The 15 s ready timeout surfaces this |
| The iframe opens but cannot be clicked, or appears behind your modal | The overlay's `z-index` is too low, or a parent element has `pointer-events: none` (R4) |
| Storage access is requested every time the user returns to the tab | The client is being destroyed or recreated (R2) |
| A dialog appears on page load or tab switch | Something calls `getPublicKey()` / `getRelays()` without a user action (R3) |
| `NO_KEY` right after the user created a passkey | The user created it in a different browser or profile, or dismissed the storage-access prompt. Click login again |
| `RATE_LIMITED` | Too many declined requests. Wait 60 s and stop automatic retries |
| The page shows a white flash on every signature | Expected: the iframe opens for every request. Set the iframe `background` and `theme` to match your app |

## More detail

- Human-oriented integration guide: [ja](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/ja/iframe-integration.ja.md) / [en](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/en/iframe-integration.en.md)
- `nosskey-iframe` package README: [en](https://github.com/ocknamo/nosskey-sdk/blob/main/packages/nosskey-iframe/README.md)
- Host internals: [iframe-host.en.md](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/en/iframe-host.en.md)
- Vanilla TypeScript demo: [`examples/parent-sample`](https://github.com/ocknamo/nosskey-sdk/tree/main/examples/parent-sample) (live at https://ocknamo.github.io/nosskey-sdk/)
