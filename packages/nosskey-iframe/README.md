# nosskey-iframe

[![npm](https://img.shields.io/npm/v/nosskey-iframe.svg)](https://www.npmjs.com/package/nosskey-iframe)
[![license](https://img.shields.io/npm/l/nosskey-iframe.svg)](./LICENSE)

`postMessage` bridge that exposes a [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md)–shaped signing API across an iframe boundary, built for the [Nosskey](https://github.com/ocknamo/nosskey-sdk) project (passkey-derived Nostr keys).

The package ships two roles in a single bundle:

- **Client** — runs in a *parent app* and mounts a signing iframe; talks to the host over `postMessage`. **No `nosskey-sdk` runtime dependency.**
- **Host** — runs *inside* the iframe (the page that actually owns the keys, e.g. `nosskey.app`). Wraps a `NosskeyManager` (from `nosskey-sdk`) and answers requests with user consent.

Pick the section that matches your role below.

---

## Install

### Client only (the common case — you embed someone else's signing iframe)

```sh
npm i nosskey-iframe
```

No additional dependency is required. `nosskey-sdk` is declared as an **optional** peer; you only need it if you build a host (see below).

### Host (you operate the signing iframe)

```sh
npm i nosskey-iframe nosskey-sdk
```

---

## Quick start — Client (parent app)

The parent page mounts the iframe and forwards `window.nostr` calls to it.

```ts
import { NosskeyIframeClient } from 'nosskey-iframe';

const client = new NosskeyIframeClient({
  iframeUrl: 'https://nosskey.app/#/iframe',
  // Optional: theme/lang are forwarded to the iframe via URL params.
  // theme: 'auto',
  // lang:  'auto',
  // Optional: container element to mount the iframe into. Defaults to document.body.
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

`NosskeyIframeClient` mounts the `<iframe>` with
`allow="publickey-credentials-get; publickey-credentials-create"`. The host page
**must also** return the matching response header:

```
Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*
```

Without that header Chromium refuses to run WebAuthn inside the iframe.

### Reload recovery (`revalidateOnReload`)

By default the client survives an iframe document discard/reload (e.g. after a
long-idle parent tab or a BFCache restore). When the host re-emits
`nosskey:ready`, any in-flight requests are re-posted with the same id and
their timeout countdown is reset, so the caller's `signEvent()` /
`getPublicKey()` promise resolves once the recovered host responds instead of
hanging until the 60-second timeout fires. A single recovery cycle therefore
costs up to `timeout` + iframe reload time; each subsequent reload resets the
countdown again, so prolonged repeated reloads can extend the wait further.

Pass `revalidateOnReload: false` to restore the legacy single-shot behavior
(ready resolves exactly once; a request whose iframe `contentWindow` is
missing rejects immediately).

For a complete walk-through (storage partitioning, Storage Access API recovery, error handling, UX modal patterns) see
[`docs/en/iframe-integration.en.md`](../../docs/en/iframe-integration.en.md).
A runnable demo lives at [`examples/parent-sample`](../../examples/parent-sample).

---

## Quick start — Host (signing provider)

If you operate the page that owns the passkey-derived keys, instantiate `NosskeyIframeHost` and feed it a `NosskeyManager`.

```ts
import { NosskeyManager } from 'nosskey-sdk';
import { NosskeyIframeHost, type ConsentRequest } from 'nosskey-iframe';

const manager = new NosskeyManager(/* storage / PRF options */);

const host = new NosskeyIframeHost({
  manager,
  // Restrict to the parent origins you trust. '*' is debug-only.
  allowedOrigins: ['https://your-parent-app.example'],
  requireUserConsent: true,
  onConsent: async (req: ConsentRequest) => {
    // Show your consent UI for req.method / req.origin / req.event etc.
    // Return true to approve, false to reject.
    return await showConsentDialog(req);
  },
  // Optional: implement NIP-07 getRelays().
  onGetRelays: async () => ({
    'wss://relay.example': { read: true, write: true },
  }),
});

host.start();
// Later, on teardown:
// host.stop();
```

Methods that touch secret material (`signEvent`, `nip44_*`, `nip04_*`) are gated by `onConsent`. `getPublicKey` and `getRelays` are not.

For the full architecture (consent UI patterns, Storage Access API, the seven NIP-07 methods, embedded theme/lang propagation) see
[`docs/en/iframe-host.en.md`](../../docs/en/iframe-host.en.md).
A reference Svelte implementation is at [`examples/svelte-app`](../../examples/svelte-app) (route `#/iframe`).

---

## Browser permissions / deployment checklist

When you ship to production, verify each item:

- The host page returns `Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*`.
- The parent embeds the iframe with `allow="publickey-credentials-get; publickey-credentials-create"` (this is automatic when you use `NosskeyIframeClient`).
- The host page sets a `Content-Security-Policy: frame-ancestors` allowlist matching the parent origins.
- Both sides are served over HTTPS (WebAuthn requirement).
- The host page's effective origin matches the WebAuthn RP-ID used when the passkey was created.
- The host implements `document.requestStorageAccess({ all: true })` on a user gesture when the parent is cross-origin (Chrome 115+ partitions third-party iframe storage). See the host guide above.

---

## API reference (named exports)

| Export | Role | Description |
|---|---|---|
| `NosskeyIframeClient` | Client | Mounts the iframe and forwards NIP-07 calls. |
| `NosskeyIframeClientOptions` | Client | Constructor options (iframe URL, container, timeout, theme, lang, revalidateOnReload). |
| `NosskeyIframeError` | Client | Typed error thrown by client methods. |
| `NosskeyIframeHost` | Host | Listens to `postMessage` and answers via a `NosskeyManager`. |
| `NosskeyIframeHostOptions` | Host | Constructor options (manager, allowed origins, consent hooks). |
| `NosskeyManagerLike` | Host | Structural subset of `nosskey-sdk`'s `NosskeyManager` that the host requires. |
| `ConsentRequest` | Host | Argument shape passed to `onConsent`. |
| `NostrEvent` | Both | NIP-01 Nostr event JSON. Locally defined (structurally identical to `nosskey-sdk`'s) and exported here so consumers don't have to install `nosskey-sdk` just for the type. |
| `NosskeyMethod`, `NosskeyRequest`, `NosskeyRequestParams`, `NosskeyResponse`, `NosskeyReady`, `NosskeyVisibility`, `NosskeyMessage`, `RelayMap`, `NosskeyErrorCode`, `NOSSKEY_ERROR_CODES` | Both | Wire protocol types and constants. |
| `isNosskeyRequest`, `isNosskeyResponse`, `isNosskeyReady`, `isNosskeyVisibility`, `isEncryptMethod`, `isDecryptMethod` | Both | Runtime type guards on the protocol messages. |

Refer to the bundled `.d.ts` for full type signatures.

---

## Compatibility

- **Node**: ≥22 (tooling only; the library itself is a browser package).
- **Browsers**: Chrome / Edge 118+ ✔, Firefox (latest) — partial PRF support, Safari — unstable inside iframes. See the [PRF support tables](../../docs/en/prf-support-tables.en.md).
- **Crypto**: WebAuthn PRF extension is required for the host-side key derivation. The client itself has no crypto requirement beyond what the browser ships.

---

## License

MIT — see [`LICENSE`](./LICENSE).

For the broader Nosskey project README see the [monorepo root](https://github.com/ocknamo/nosskey-sdk#readme).
