# Nosskey iframe Integration Guide (for parent apps)

This document is a step-by-step guide for **developers who want to embed the Nosskey signing iframe into their own Nostr web app**. Using the production host [`https://nosskey.app/#/iframe`](https://nosskey.app/#/iframe) as the example, it explains how to integrate via the `NosskeyIframeClient` from the [`nosskey-iframe`](../../packages/nosskey-iframe) package.

> For the internal architecture of the iframe host side (the `#/iframe` route of `examples/svelte-app`), see [`iframe-host.en.md`](./iframe-host.en.md).

## Overview

Embedding `nosskey.app/#/iframe` as an iframe lets your parent app use Nostr signing and encryption **without ever handling a private key**.

- The key is derived from a passkey (WebAuthn PRF) bound to the `nosskey.app` origin and is only used inside the iframe. The private key never reaches the parent app.
- The parent app obtains a [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) compatible `window.nostr` API. It can be dropped into existing Nostr clients.
- Every app that embeds it shares the same passkey, so users can reuse a single "Nosskey identity" across multiple Nostr apps.

Intended audience: developers of cross-origin Nostr web apps.

## How it works

The parent page and the iframe exchange JSON-RPC-style messages over `window.postMessage`. `NosskeyIframeClient` hides this communication, so you do not need to write `postMessage` yourself.

```
Parent app                            nosskey.app/#/iframe
──────────                            ────────────────────
new NosskeyIframeClient(...)
  │ create & mount the iframe element
  ▼
                                       iframe host starts
  await client.ready() ◄─────────────  nosskey:ready
  │
  ▼
set window.nostr = { ... }

client.signEvent(event)
  │ nosskey:request ────────────────►  show consent dialog
  │                                      │ user approves
  │ nosskey:response ◄─────────────────  sign via WebAuthn PRF
  ▼
receive the signed event
```

Key points:

- **`nosskey:ready` handshake**: wait for the iframe to finish initializing with `client.ready()` before use.
- **Consent dialogs render inside the iframe**: signing, encryption, and similar operations go through user consent. The dialog is rendered within the iframe.
- **Automatic visibility toggling**: when a dialog or storage permission is needed, the iframe sends a `nosskey:visibility` message to the parent, and `NosskeyIframeClient` automatically shows/hides the iframe element.

## Prerequisites

- **Browser**: Chrome 118+ is recommended. Firefox has limited PRF support, and Safari / iOS are not supported at this time.
- **HTTPS**: the parent page must be served over HTTPS (or `localhost`). This is a WebAuthn requirement.
- **Passkey created in advance**: the user must first open `https://nosskey.app` directly and create a passkey (Nosskey identity). If none exists, signing-related methods return a `NO_KEY` error.

## Installation

```sh
npm install nosskey-iframe
```

`nosskey-iframe` depends on `nosskey-sdk`, which also provides type definitions such as `NostrEvent`.

## Quick start

```ts
import { NosskeyIframeClient } from 'nosskey-iframe';

const client = new NosskeyIframeClient({
  iframeUrl: 'https://nosskey.app/#/iframe',
});

// Wait for the iframe to become ready (nosskey:ready)
await client.ready();

// Expose a NIP-07 compatible window.nostr
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

The `NosskeyIframeClient` constructor creates the iframe element and appends it to `document.body` (or to the `container` described below). The iframe is automatically given the `allow="publickey-credentials-get; publickey-credentials-create"` attribute required for WebAuthn.

## Supported methods

`NosskeyIframeClient` provides all 7 NIP-07 methods. The 5 methods that handle secret material go through user consent.

| Client API | Return type | Consent | Purpose |
|------------|-------------|---------|---------|
| `getPublicKey()` | `Promise<string>` | not required | Returns the public key (hex) |
| `getRelays()` | `Promise<RelayMap>` | not required | Returns the relay configuration |
| `signEvent(event)` | `Promise<NostrEvent>` | required | Signs a Nostr event |
| `nip44.encrypt(peer, plaintext)` | `Promise<string>` | required | NIP-44 v2 encryption |
| `nip44.decrypt(peer, ciphertext)` | `Promise<string>` | required | NIP-44 v2 decryption |
| `nip04.encrypt(peer, plaintext)` | `Promise<string>` | required | NIP-04 (legacy) encryption |
| `nip04.decrypt(peer, ciphertext)` | `Promise<string>` | required | NIP-04 (legacy) decryption |

`peer` is the counterparty public key (32-byte hex). `RelayMap` is of type `Record<string, { read: boolean; write: boolean }>`.

> NIP-04 is a legacy, unauthenticated scheme (AES-CBC). Use NIP-44 v2 for new implementations. NIP-04 is kept only for interoperability with older clients.

## Client options

The `NosskeyIframeClient` constructor takes `NosskeyIframeClientOptions`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `iframeUrl` | `string` | (required) | Absolute URL of the Nosskey iframe. e.g. `https://nosskey.app/#/iframe` |
| `container` | `HTMLElement` | `document.body` | Parent element the iframe is appended to |
| `timeout` | `number` | `60000` | Request timeout in milliseconds |
| `theme` | `'light' \| 'dark' \| 'auto'` | (unset) | Theme passed to the iframe. `auto` is resolved inside the iframe via `prefers-color-scheme` |
| `lang` | `'ja' \| 'en' \| 'auto'` | (unset) | Language passed to the iframe. `auto` is resolved inside the iframe via `navigator.language` |

- When `theme` / `lang` is set, `?embedded=1&theme=...&lang=...` is automatically appended to the iframe URL.
- `theme` / `lang` are **applied only when the iframe loads**. To switch them at runtime, call `destroy()` and re-create the client with the new values.

## Placing the iframe and visibility control

The iframe created by `NosskeyIframeClient` is initially hidden with `display: none`. When a signing/encryption consent dialog or a storage access permission is needed, the iframe sends a `nosskey:visibility` message (`{ type: 'nosskey:visibility', visible: boolean }`), and `NosskeyIframeClient` automatically toggles the iframe element's `display`.

However, **where and at what size the iframe is placed is the parent app's responsibility**. Place the iframe somewhere visible on screen so the user can interact with the consent dialog. The recommended pattern is a modal / overlay.

```ts
const client = new NosskeyIframeClient({
  iframeUrl: 'https://nosskey.app/#/iframe',
  theme: 'auto',
  lang: 'auto',
});

// Get the created iframe element and move it into a modal card
const modalCard = document.querySelector('#nosskey-modal .card');
modalCard.appendChild(client.iframe);

await client.ready();
```

- `client.iframe` gives you the iframe element (`HTMLIFrameElement`). Use CSS to set its size, position, and `z-index`.
- If the parent app also wants to show a backdrop, subscribe to the `nosskey:visibility` message with `window.addEventListener('message', ...)` and sync the modal frame's visibility.
- When started in embedded mode (`embedded=1`, by specifying `theme` / `lang`), the iframe makes its body transparent so the consent modal blends into the card frame the parent provides.

## Handling storage partitioning

With Chrome 115+ and Firefox's Total Cookie Protection, **a cross-origin iframe's `localStorage` is partitioned per top-level origin**. Passkey info saved while `nosskey.app` was the top-level page is not visible to the iframe embedded in a different parent origin, so the first `getPublicKey()` / `signEvent()` returns a `NO_KEY` error.

The iframe host automatically recovers from this via the Storage Access API:

1. The iframe detects the partitioned state and sends `nosskey:visibility { visible: true }` to make itself visible.
2. The user clicks the "Grant storage access" button inside the iframe.
3. The browser shows a permission dialog. On approval, the iframe re-reads the key from first-party storage and hides itself again.
4. The parent app simply retries `getPublicKey()` / `signEvent()` and they succeed.

This flow is handled automatically by the host and `NosskeyIframeClient`, but **you must place the iframe somewhere visible so the user can click the "Grant storage access" button** (see the previous section). If the user denies permission, or the browser does not support the Storage Access API, the fallback is to have the user open `nosskey.app` directly in a separate tab.

See [`iframe-host.en.md`](./iframe-host.en.md#storage-partitioning--storage-access-api) for details.

## Error handling

When the iframe returns an error response, the corresponding method's Promise rejects with a `NosskeyIframeError`. Use `error.code` to distinguish error types.

```ts
import { NosskeyIframeError } from 'nosskey-iframe';

try {
  const pubkey = await client.getPublicKey();
} catch (err) {
  if (err instanceof NosskeyIframeError) {
    if (err.code === 'NO_KEY') {
      // No passkey is configured in the iframe, or the key is hidden by storage partitioning
    } else if (err.code === 'USER_REJECTED') {
      // The user denied the request in the consent dialog
    }
  }
}
```

| Error code | Meaning |
|------------|---------|
| `NO_KEY` | No passkey is configured in the iframe, or the key is hidden by storage partitioning |
| `USER_REJECTED` | The user denied the request in the consent dialog |
| `NOT_AUTHORIZED` | The requesting origin is not allowed |
| `UNKNOWN_METHOD` | An unsupported method was called |
| `INVALID_REQUEST` | The parameters are invalid |
| `INTERNAL` | An internal error inside the iframe |

In addition, a request that exceeds `timeout` (default 60 seconds) rejects with a plain `Error`.

## Cleanup

Call `destroy()` when the client is no longer needed. It removes the iframe element, detaches the `message` listener, and rejects any pending requests.

```ts
client.destroy();
window.nostr = undefined;
```

## Full example

For a working parent-app implementation, see [`examples/parent-sample`](../../examples/parent-sample) in the repository. It is a Vanilla TypeScript + Vite app that demonstrates modal placement, `window.nostr` setup, calls to each NIP method, and `NO_KEY` handling.

A live build of this sample is hosted at [https://ocknamo.github.io/nosskey-sdk/](https://ocknamo.github.io/nosskey-sdk/), where you can try the embedding flow in the browser.

A snippet of the key modal placement:

```ts
const client = new NosskeyIframeClient({ iframeUrl, theme, lang });
// Move the created iframe into the modal card
modalCard.appendChild(client.iframe);
await client.ready();
window.nostr = {
  /* ... see "Quick start" above ... */
};
```

## Production notes

- **`allow` attribute**: the `allow="publickey-credentials-get; publickey-credentials-create"` attribute required to run WebAuthn inside the iframe is added automatically by `NosskeyIframeClient`. Nothing to wire up on the parent side.
- **Permissions-Policy header**: the iframe host must return a `Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*` header. `nosskey.app` already does this.
- **Browser support**: see the table below.

| Browser | PRF extension | iframe + WebAuthn | Status |
|---------|---------------|-------------------|--------|
| Chrome 118+ | ✅ | ✅ (with Permissions-Policy) | Supported |
| Firefox (latest) | limited | spec-compliant | Limited |
| Safari / iOS | limited (Safari 18) | unstable in iframes | **Not supported** |

If you want to host the iframe host yourself, [`iframe-host.en.md`](./iframe-host.en.md) explains the host-side architecture (`NosskeyIframeHost`, the consent flow, Permissions-Policy).

## Related documentation

- [iframe host explanation](./iframe-host.en.md) — how the iframe host that runs on the `#/iframe` route works
- [`nosskey-iframe` package](../../packages/nosskey-iframe) — source code
- [`examples/parent-sample`](../../examples/parent-sample) — parent-app implementation example
- [Live parent-app demo](https://ocknamo.github.io/nosskey-sdk/) — hosted build of `examples/parent-sample`
- [Root README](../../README.md) — overview of the Nosskey SDK as a whole
- [Nosskey Specification](./nosskey-specification.en.md)
