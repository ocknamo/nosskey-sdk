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
  // Required (no default). List the parent origins you trust, or pass '*' to
  // deliberately opt in to open embedding (any origin; emits a console warning).
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
  // Optional: per-origin rate limit (defaults shown). Pass `false` to disable.
  rateLimit: { maxConsecutiveRejections: 5, blockMs: 60_000 },
});

host.start();
// Later, on teardown:
// host.stop();
```

All seven NIP-07 methods are gated by `onConsent`. For `getPublicKey` / `getRelays` the consent acts as a per-origin connection approval (pairing) — the same model NIP-07 browser extensions use — so an arbitrary embedding site cannot silently read the logged-in user's npub or relay list. Remember approved origins in your consent UI (the reference app stores them as trusted origins) to keep login flows friction-free.

**Per-origin rate limiting (enabled by default):** after `maxConsecutiveRejections` (default 5) consecutive rejections from one origin, the host short-circuits further consent-required requests with a `RATE_LIMITED` error — no dialog shown — for `blockMs` (default 60 s). A single approval resets the counter. This blunts consent-fatigue and decryption-oracle probing at the protocol layer, independent of your `onConsent` UI. Tune it via `rateLimit`, or set `rateLimit: false` to opt out.

> **Breaking change (security fix):** earlier versions served `getPublicKey` / `getRelays` without consent. Hosts that keep the default `requireUserConsent: true` must provide `onConsent`, or these methods now fail with `INTERNAL`. To restore the old silent behavior, opt out explicitly with `requireUserConsent: false`. `getRelays` still returns `{}` without prompting when `onGetRelays` is not configured or no key is set.

> **Breaking change (secure-by-default):** `allowedOrigins` is now **required** — it no longer defaults to `'*'`. Omitting it throws at construction. Pass an explicit allowlist (recommended when the parent origin is known, e.g. self-hosted integrations), or the literal `'*'` to deliberately opt in to open embedding. This keeps the open-embedding model available for hosts that want it while preventing "accept every origin" from being a silent default.

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
| `NosskeyIframeClientOptions` | Client | Constructor options (iframe URL, container, timeout, theme, lang). |
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
