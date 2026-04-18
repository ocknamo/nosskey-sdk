# Nosskey iframe Host (`examples/svelte-app`) Architecture

The `examples/svelte-app` project switches into a **dedicated Nostr signing
provider mode** when accessed via the `#/iframe` route. This document explains
how that mode is implemented.

In production it is served at [`https://nosskey.app/#/iframe`](https://nosskey.app/#/iframe)
and embedded as an iframe by Nostr web apps hosted on different origins.

## Overview

In iframe mode the app renders **no normal UI** (header / footer / screens).
It focuses purely on handling postMessage requests from the parent page.

A parent app (different origin) talks to this iframe via the
`NosskeyIframeClient` exported from the
[`nosskey-iframe`](../../packages/nosskey-iframe) package, allowing **a single
passkey bound to the Nosskey origin (`nosskey.app`) to be shared across every
Nostr app**.

## Components

### 1. Routing — `App.svelte`

```svelte
{#if screen === "iframe"}
  <IframeHostScreen />   <!-- iframe mode: minimal UI -->
{:else}
  <HeaderBar /> ... <FooterMenu />   <!-- normal UI -->
{/if}
```

Swapping the entire root tree on `#/iframe` prevents UI flashes and avoids
parent-page style interference.

### 2. Entry screen — `IframeHostScreen.svelte`

- Calls `startIframeHost()` in `onMount` to launch `NosskeyIframeHost`
- Calls the returned stop function in `onDestroy` to detach the postMessage
  listener
- Always mounts `<ConsentDialog />` (which renders only when a request is
  pending)
- Shows a warning if no key is present at startup

### 3. Host bootstrap & consent bridge — `iframe-mode.ts`

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

Key points:

- **Reuses the existing SDK**: `getNosskeyManager()` returns the
  `NosskeyManager` singleton (already persisting keys in localStorage), and we
  hand it directly to the host
- **Promise bridge**: when the host calls `onConsent`, we return a Promise and
  stash its `resolve` in the store; the host blocks until a UI button is
  pressed
- **UI to host wiring**: `approveConsent()` / `rejectConsent()` invoke the
  stored resolve function to settle the Promise
- `allowedOrigins: '*'` is for demo purposes only. Production hosts should
  restrict this to a specific allowlist

### 4. Consent UI — `ConsentDialog.svelte`

Renders a modal only when `$pendingConsent` is non-null:

- **origin**: requesting page URL
- **event.kind / content / tags**: contents of the event being signed
  (`content` is truncated to 240 chars)
- Approve / reject buttons → `approveConsent()` / `rejectConsent()`

`getPublicKey` does not require consent (it is just the public key); only
`signEvent` triggers the dialog.

## Communication flow (signEvent)

```
Parent page                    svelte-app (iframe)
───────────                    ───────────────────
client.signEvent(event)
  │ postMessage
  ▼
                                NosskeyIframeHost receives
                                  │
                                  ▼
                                onConsent(request) called
                                  │
                                  │ push to pendingConsent store
                                  ▼
                                ConsentDialog shown
                                  │
                                  │ user clicks "Approve"
                                  ▼
                                approveConsent() → resolve(true)
                                  │
                                  ▼
                                manager.signEvent(event)
                                  │ (sign via WebAuthn PRF)
                                  ▼
  postMessage ◄── signed event
  │
  ▼
client.signEvent Promise resolves
```

## Production deployment

- **Production URL**: `https://nosskey.app/#/iframe` (deployed on Cloudflare
  Pages)
- **Permissions-Policy**: the host (where svelte-app is served) must respond
  with:

  ```
  Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*
  ```

- **Embedder attribute**: Chrome requires the following `allow` attribute on
  the iframe element:

  ```html
  <iframe allow="publickey-credentials-get; publickey-credentials-create"></iframe>
  ```

  `NosskeyIframeClient` adds this automatically.

## How a passkey is shared

1. The user creates a passkey at `https://nosskey.app/#/account` (RP ID =
   `nosskey.app`)
2. Other apps A, B, C subsequently embed `https://nosskey.app/#/iframe`
3. All three apps can sign with the same passkey — WebAuthn is bound to the
   origin (`nosskey.app`), and inside the iframe that origin is in scope
4. `NostrKeyInfo` is stored in svelte-app's localStorage, but the PRF value is
   re-derived through WebAuthn on each operation, so the raw secret key is
   never exposed

The result: instead of "one passkey per Nostr app", users get **one Nosskey
identity shared across every Nostr app**.

## Related documents

- [Parent-page usage (root README)](../../README.md#iframe-mode-cross-origin-signing)
- [`nosskey-iframe` package](../../packages/nosskey-iframe)
- [Nosskey specification](./nosskey-specification.en.md)
