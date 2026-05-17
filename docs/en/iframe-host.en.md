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

## Supported methods

The iframe host is a **full NIP-07 provider**. It handles seven methods; five
of them touch secret material and therefore go through the consent flow.

| Method (protocol) | SDK method | Consent | Purpose |
|-------------------|------------|---------|---------|
| `getPublicKey`  | `getPublicKey()`  | — (none)   | Return the current public key |
| `getRelays`     | (host callback)   | — (none)   | Return the relay configuration |
| `signEvent`     | `signEvent()`     | required   | Sign a Nostr event |
| `nip44_encrypt` | `nip44Encrypt()`  | required   | NIP-44 v2 encryption |
| `nip44_decrypt` | `nip44Decrypt()`  | required   | NIP-44 v2 decryption |
| `nip04_encrypt` | `nip04Encrypt()`  | required   | NIP-04 (legacy) encryption |
| `nip04_decrypt` | `nip04Decrypt()`  | required   | NIP-04 (legacy) decryption |

The protocol method names (underscore form) and the
`CONSENT_REQUIRED_METHODS` list are defined in
[`packages/nosskey-iframe/src/protocol.ts`](../../packages/nosskey-iframe/src/protocol.ts).
`getPublicKey` and `getRelays` only expose non-secret data, so they never
trigger a dialog.

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
- Runs the **Storage Access API** recovery flow on startup (see
  [Storage partitioning](#storage-partitioning--storage-access-api) below) and
  renders a small status card (`partitioned` / `denied` / `granted` /
  `noKeyExists` / `unsupported`) when attention is needed
- Adds the `body.nosskey-embedded` class when launched in embedded mode so the
  modal blends into the parent-provided card

### 3. Host bootstrap & consent bridge — `iframe-mode.ts`

```ts
export const pendingConsent = writable<PendingConsent | null>(null);

export function onConsent(request: ConsentRequest): Promise<boolean> {
  const evaluation = evaluateConsent(request, {
    trustedOrigins: get(trustedOrigins),
    policy: get(consentPolicy),
  });
  if (evaluation.decision === 'approve') return Promise.resolve(true);
  if (evaluation.decision === 'reject') {
    // policy=deny: warn + count so silent probing stays observable
    incrementDenyCount(policyKeyFor(request.method));
    return Promise.resolve(false);
  }
  // decision === 'ask': show the dialog and wait for the user
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

Key points:

- **Reuses the existing SDK**: `getNosskeyManager()` returns the
  `NosskeyManager` singleton (already persisting keys in localStorage), and we
  hand it directly to the host
- **Consent is gated, not just prompted**: `onConsent` delegates to the pure
  `evaluateConsent()` function. Depending on the saved policy / trusted-origin
  list it may auto-approve, auto-reject, or fall through to the dialog
- **Promise bridge**: on the `ask` path we return a Promise and stash its
  `resolve` in the `pendingConsent` store; the host blocks until a UI button
  is pressed
- **`getRelays` callback**: `onGetRelays` reads the relay map through the SDK's
  storage handle so it hits first-party storage after a Storage Access grant
- `allowedOrigins: '*'` only opens the postMessage entry point for the demo.
  It is **not** an origin filter — production hosts must restrict it to a
  specific allowlist

### 4. Consent gating — `consent-gating.ts` + `app-state.ts`

Before any dialog is shown, `evaluateConsent()`
([`utils/consent-gating.ts`](../../examples/svelte-app/src/utils/consent-gating.ts))
decides the outcome with no side effects. Evaluation order (safest first):

1. Method policy is `deny` → **reject** immediately (overrides trusted origins)
2. Method policy is `always` → **approve** immediately
3. The requesting origin is trusted **for this method** → **approve**
4. Otherwise → **ask** (show the dialog)

Two pieces of persisted state drive this (both in
[`store/app-state.ts`](../../examples/svelte-app/src/store/app-state.ts)):

- **`ConsentPolicy`** — per-method decision (`ask` / `always` / `deny`) keyed
  by `signEvent` / `nip44` / `nip04`. `nip44_encrypt` and `nip44_decrypt`
  collapse into the `nip44` bucket (same for `nip04`). Stored under
  `localStorage` key `nosskey_consent_policy`.
- **`TrustedOriginEntry[]`** — "always allow this site" records, scoped by
  `origin × method` rather than blanket-allowing an origin. Stored under
  `localStorage` key `nosskey_trusted_origins_v2`.

Auto-rejected requests increment a per-method `denyCounts` store so a malicious
parent cannot silently probe (e.g. repeated `nip04_decrypt` against arbitrary
pubkeys) without the user being able to notice.

Both policy and trusted origins are editable from the Settings screen
(`ConsentPolicySettings.svelte` / `TrustedOriginsSettings.svelte`).

### 5. Consent UI — `ConsentDialog.svelte`

Renders a modal only when `$pendingConsent` is non-null. It adapts to the
requested method:

- **origin**: requesting page URL
- **method**: human-readable label (`signEvent` / NIP-44 / NIP-04 encrypt /
  decrypt)
- **For `signEvent`**: `event.kind` with a readable label (`kindLabel()`),
  `content` truncated to **100 characters**, the tag list, and the full raw
  event JSON folded inside a `<details>` element
- **For nip44/nip04**: the counterparty pubkey rendered as a shortened `npub`
  (`renderPeerPubkey()`); encrypt requests also preview the plaintext
  (100-char truncation), while decrypt requests show no plaintext preview
- **Three buttons**:
  - **Reject** → `rejectConsent()`
  - **Always allow** → `approveConsent({ trustOrigin: true })` — approves and
    adds `origin × method` to the trusted list
  - **Approve once** → `approveConsent({ trustOrigin: false })`

## Communication flow

### `signEvent` (consent required)

```
Parent page                    svelte-app (iframe)
───────────                    ───────────────────
client.signEvent(event)
  │ postMessage
  ▼
                                NosskeyIframeHost receives
                                  │
                                  ▼
                                onConsent(request) → evaluateConsent()
                                  │
                                  ├─ policy=deny  → reject (no dialog)
                                  ├─ policy=always / trusted origin → approve
                                  │                                   (no dialog)
                                  └─ ask → pendingConsent store → ConsentDialog
                                            │ user clicks "Approve once" /
                                            │ "Always allow"
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

### `nip44.encrypt` / `nip04.encrypt` / `*.decrypt`

The encryption methods follow the same consent path. The host calls the
matching SDK method (`manager.nip44Encrypt(pubkey, plaintext)` etc.) and
returns the ciphertext (or plaintext, for decrypt) to the parent.

### `getPublicKey` / `getRelays` (no consent)

These resolve immediately — `getPublicKey` from the current `NostrKeyInfo`,
`getRelays` from the `onGetRelays` callback — without touching the consent
flow.

## Storage partitioning & Storage Access API

Chrome 115+ and Firefox's Total Cookie Protection **partition third-party
iframe `localStorage` per top-level origin**. A `NostrKeyInfo` record saved at
`nosskey.app` (first-party) is not visible to the iframe embedded under a
different parent origin, so a naive first call returns `NO_KEY`.

`IframeHostScreen.svelte` recovers as follows:

1. On mount it calls `document.requestStorageAccess({ all: true })`. Browsers
   that remember a prior grant for this `top-level × iframe` origin pair
   resolve **silently** (no user gesture), so returning users skip the prompt.
2. A first visit / expired grant rejects with `NotAllowedError`. The screen
   then shows a `partitioned` card with a "grant access" button, and posts
   `nosskey:visibility { visible: true }` so the parent reveals the iframe for
   the required user gesture.
3. On a successful grant, the Chromium handle's `localStorage` is threaded into
   the SDK singleton via `manager.setStorageOptions({ storage })` (Chromium
   keeps `window.localStorage` partitioned even after the grant — only the
   handle points at first-party storage). `reloadSettings()` re-reads the
   consent policy, trusted origins and cache options through that same handle.
4. If the user already has a partitioned key, signing still works with the
   cached key even before a grant; only first-party data (relays, etc.) stays
   unreachable until access is granted.

The `nosskey:visibility` postMessage is part of the protocol; the parent-side
`NosskeyIframeClient` toggles the iframe element's visibility automatically.

## Theme, language & embedded mode

A parent app can pass display preferences via URL query parameters that
`NosskeyIframeClient` appends through its `buildIframeUrl()` helper:

- `?theme=light|dark|auto` — applied by `app-state.ts`
- `?lang=ja|en|auto` — applied by `i18n-store.ts`
- `?embedded=1` — automatically added whenever `theme` or `lang` is set

In embedded mode (`embedded=1`) the iframe **does not write theme / language
back to `localStorage`**, so a later standalone visit keeps the user's own
preference. It also adds the `body.nosskey-embedded` class, which makes the
body transparent and lets the consent modal fill the parent-provided card
frame seamlessly.

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
- [iframe expansion plan](../iframe-expansion-plan.md) — roadmap and status
- [Nosskey specification](./nosskey-specification.en.md)
