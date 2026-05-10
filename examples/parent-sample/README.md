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
3. Install a NIP-07 compatible
   `window.nostr = { getPublicKey, signEvent, getRelays, nip44, nip04 }`.
4. Call `getPublicKey()` and `getRelays()`.
5. Build a kind:1 event, sign it through the iframe (consent dialog is shown
   inside the iframe/host page), and publish it via raw WebSocket to a public
   relay (default `wss://relay.damus.io`).
6. **NIP-44 encrypt / decrypt** (modern, recommended): self-encrypt with the
   "Use my pubkey" helper to verify the round trip without a second account.
   Encrypt and decrypt each prompt the consent dialog independently.
7. **NIP-04 encrypt / decrypt** (legacy): same shape as NIP-44, with a
   deprecation warning. Useful for verifying interop with older clients.
8. **NIP-17 sealed DM** (gift-wrapped kind:1059): builds a kind:14 rumor,
   NIP-44 seals it as kind:13, NIP-44 wraps that as kind:1059 signed by an
   ephemeral key, and publishes to a relay. Compatible clients (Amethyst,
   0xchat, Coracle, Damus chat) decrypt it automatically.
9. Surface `NosskeyIframeError.code` values such as `NO_KEY`,
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

### Manual E2E test for NIP-44 / NIP-04

After **Connect** succeeds:

1. Scroll to **5. NIP-44 encrypt / decrypt**.
2. Click **Use my pubkey** (this fills the peer field with your own pubkey,
   so encrypt and decrypt operate on the same key).
3. Click **Encrypt → ciphertext** — the host page will pop a consent dialog
   showing the peer pubkey and a plaintext preview. Approve it. The
   `ciphertext` textarea fills with a base64 NIP-44 v2 payload.
4. Click **Decrypt → plaintext** — the host page pops a second consent
   dialog (this time with no plaintext preview, since the iframe cannot
   inspect the ciphertext before consent). Approve it. The decrypted
   output should match what you encrypted.
5. Repeat with section **6. NIP-04 encrypt / decrypt** to verify the
   legacy path. Note that NIP-04 is unauthenticated (AES-CBC) — the SDK
   marks it as deprecated; only use it for interop with old clients.

To test cross-account interop, paste a peer pubkey from another Nostr
client into the peer field, encrypt, send the ciphertext over any channel
to that other client, and have it decrypt — and vice versa.

### Sending a real DM to another user

Section **6. NIP-04 encrypt / decrypt** has a **Send DM (kind:4 → relay)**
button that combines the steps above into one flow:

1. Paste the recipient's hex pubkey into the section-6 peer field.
2. Type the plaintext.
3. Make sure the Relay URL in section 4 points to a relay both you and
   the recipient use (default `wss://relay.damus.io`).
4. Click **Send DM**. The host page pops two consent dialogs in order —
   one for encryption, one for the kind:4 event signature. Approve both.
5. The relay's `OK` / `NOTICE` ack appears in the log.
6. The recipient's Nostr client should receive a kind:4 event with
   `tags: [["p", your_pubkey]]` and decrypt it with their own NIP-04
   implementation.

### Sending a NIP-17 sealed DM (recommended)

Section **7. NIP-17 sealed DM** publishes a gift-wrapped kind:1059 event
that compatible clients (Amethyst, 0xchat, Coracle, Damus chat) recognize
as a private message. Steps:

1. Click **Use my pubkey** to self-encrypt for one-account verification, or
   paste any recipient hex pubkey.
2. Type the message.
3. Confirm the Relay URL in section 4 points at a relay both ends use
   (default `wss://relay.damus.io`).
4. Click **Send NIP-17 DM**. Two consent dialogs appear:
   - NIP-44 encrypt for the kind:13 seal (shows the rumor JSON preview).
   - signEvent for the kind:13 seal.
5. The relay's `OK` ack appears in the log along with the gift wrap event
   id and the ephemeral pubkey.
6. Open Amethyst (Android), 0xchat (web/mobile), or any other NIP-17 client
   signed in with the recipient npub and verify the DM arrives in the inbox
   with the correct plaintext.

> The sample sends a single gift wrap addressed to the peer. NIP-17 also
> lets the sender wrap a copy to themselves to keep an outbox visible
> across their own devices; that's intentionally skipped here — verifying
> reception in another client only needs the recipient copy.

The NIP-17 helper (`src/nip17.ts`) is self-contained and only depends on
`@noble/curves` for the ephemeral keypair and the SDK's exported
`nip44Encrypt` for the gift-wrap layer; the seal layer goes through the
iframe so the user's Nosskey never leaves the host origin.

## Browser support

- **Chrome 118+** — fully supported (WebAuthn PRF + iframe).
- **Firefox (latest)** — partial; PRF support is limited.
- **Safari / iOS** — not supported at this time. See
  [`docs/iframe-plan.md`](../../docs/iframe-plan.md) for the rationale.

## First-run: storage partitioning

Modern browsers (Chrome 115+, Firefox) **partition third-party iframe storage
per top-level origin**. When the parent page lives on a different origin than
the Nosskey iframe host (e.g. `parent.example` embedding `nosskey.app`), the
iframe's `localStorage` is isolated from the first-party `nosskey.app` storage
where the passkey info was saved. The iframe cannot see the key and responds
with `NO_KEY`.

The host page handles this automatically via the Storage Access API:

1. `getPublicKey()` returns `NO_KEY`.
2. The iframe detects the partitioned state and requests the parent to show
   it (a `nosskey:visibility` message handled inside `NosskeyIframeClient`).
3. The user clicks **Grant storage access** inside the now-visible iframe.
4. The browser prompts for permission. On approval, the iframe reloads the
   key from unpartitioned storage and signals the parent to hide itself.
5. The parent retries `getPublicKey()` / `signEvent()` and they succeed.

If the user denies storage access, or uses a browser without the Storage
Access API, the fallback is to open the host origin directly
(`https://nosskey.app/#/settings`) in a separate tab and create a key there;
the parent iframe will still need storage access to read that key.

## Notes

- The `allow="publickey-credentials-get; publickey-credentials-create"`
  attribute required for WebAuthn inside the iframe is added by
  `NosskeyIframeClient` itself — nothing to wire up on the parent side.
- The production host must serve a
  `Permissions-Policy: publickey-credentials-get=*, publickey-credentials-create=*`
  header. The bundled svelte-app dev server is only used for local testing.
- The WebSocket publish path is deliberately minimal (no `nostr-tools`): it
  sends `["EVENT", signedEvent]` and logs the first `OK` / `NOTICE` frame.
