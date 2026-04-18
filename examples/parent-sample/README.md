# parent-sample

Minimal Vanilla TS + Vite example of a **parent page** that embeds the Nosskey
signing iframe via [`nosskey-iframe`](../../packages/nosskey-iframe) and exposes
a NIP-07 compatible `window.nostr`.

Runs on port **5174** by default so it lives on a different origin than the
host example (`svelte-app` on port 5173), exercising the cross-origin
`postMessage` path that production deployments actually use.

## What it demonstrates

1. Mount `NosskeyIframeClient` against a host URL (default
   `http://localhost:5173/#/iframe`).
2. Wait for the `nosskey:ready` handshake.
3. Install a NIP-07 compatible `window.nostr = { getPublicKey, signEvent }`.
4. Call `getPublicKey()`.
5. Build a kind:1 event, sign it through the iframe (consent dialog is shown
   inside the iframe/host page), and publish it via raw WebSocket to a public
   relay (default `wss://relay.damus.io`).
6. Surface `NosskeyIframeError.code` values such as `NO_KEY`,
   `USER_REJECTED`, `NOT_AUTHORIZED` in the log.

## Run locally

From the monorepo root:

```sh
npm install

# Terminal 1 — host (svelte-app) on http://localhost:5173
npm run dev -w svelte-app
# Visit http://localhost:5173/#/settings once to create a passkey and store
# an encrypted secret key. The iframe route is http://localhost:5173/#/iframe.

# Terminal 2 — parent sample on http://localhost:5174
npm run dev -w parent-sample
```

Open <http://localhost:5174/> in Chrome and click **Connect**, then
**Get public key**, then **Sign & publish**.

## Browser support

- **Chrome 118+** — fully supported (WebAuthn PRF + iframe).
- **Firefox (latest)** — partial; PRF support is limited.
- **Safari / iOS** — not supported at this time. See
  [`docs/iframe-plan.md`](../../docs/iframe-plan.md) for the rationale.

## Notes

- The `allow="publickey-credentials-get; publickey-credentials-create"`
  attribute required for WebAuthn inside the iframe is added by
  `NosskeyIframeClient` itself — nothing to wire up on the parent side.
- The production host must serve a
  `Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*`
  header. The bundled svelte-app dev server is only used for local testing.
- The WebSocket publish path is deliberately minimal (no `nostr-tools`): it
  sends `["EVENT", signedEvent]` and logs the first `OK` / `NOTICE` frame.
