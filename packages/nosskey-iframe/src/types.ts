/**
 * Local type definitions for nosskey-iframe.
 *
 * These types are redefined locally (instead of imported from `nosskey-sdk`) so
 * that the generated `.d.ts` does not carry any `import 'nosskey-sdk'` at the
 * type level. Client-only consumers can then skip installing the optional
 * `nosskey-sdk` peer dependency entirely (works even under
 * `tsconfig.compilerOptions.skipLibCheck: false`).
 *
 * Shapes are kept structurally compatible with `nosskey-sdk` so values flow
 * freely between the two packages. The compile-time assertions at the bottom
 * of this file (built against the dev-only `nosskey-sdk` import) guard against
 * drift.
 *
 * @packageDocumentation
 */

/** NIP-01 Nostr event JSON. Structurally identical to `nosskey-sdk`'s `NostrEvent`. */
export interface NostrEvent {
  /** sha256 hash of the serialized event (hex). */
  id?: string;
  /** Author public key (hex). */
  pubkey?: string;
  /** Unix timestamp in seconds. */
  created_at?: number;
  /** Event kind. */
  kind: number;
  /** Tag array. */
  tags?: string[][];
  /** Event content payload. */
  content: string;
  /** Schnorr signature (hex). */
  sig?: string;
}

/**
 * Minimal NosskeyManager surface that {@link NosskeyIframeHost} actually calls.
 *
 * Declared as a structural subset so the full `NosskeyManager` from
 * `nosskey-sdk` satisfies it without modification, while keeping the iframe
 * package's public `.d.ts` free of `import 'nosskey-sdk'`.
 *
 * Host implementers normally pass an instance of `nosskey-sdk`'s
 * `NosskeyManager`; structural typing accepts it directly.
 */
export interface NosskeyManagerLike {
  /** Returns true when a `NostrKeyInfo` is available (memory or storage). */
  hasKeyInfo(): boolean;
  /** NIP-07 `getPublicKey`. */
  getPublicKey(): Promise<string>;
  /** NIP-07 `signEvent`. */
  signEvent(event: NostrEvent): Promise<NostrEvent>;
  /** NIP-44 v2 encrypt. */
  nip44Encrypt(peerPubkey: string, plaintext: string): Promise<string>;
  /** NIP-44 v2 decrypt. */
  nip44Decrypt(peerPubkey: string, ciphertext: string): Promise<string>;
  /** NIP-04 encrypt (legacy DM). */
  nip04Encrypt(peerPubkey: string, plaintext: string): Promise<string>;
  /** NIP-04 decrypt. */
  nip04Decrypt(peerPubkey: string, ciphertext: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Compile-time drift guard.
//
// Imports below resolve through the dev-only `nosskey-sdk` workspace dep and
// are erased by tsup. If `nosskey-sdk` ever drifts (e.g. tightens `NostrEvent`
// or changes one of the seven `NosskeyManagerLike` method signatures we
// depend on), one of these assertions becomes a type error and the build
// fails — surfacing the incompatibility before publish.
// ---------------------------------------------------------------------------

import type {
  NosskeyManagerLike as SdkNosskeyManagerLike,
  NostrEvent as SdkNostrEvent,
} from 'nosskey-sdk';

type _AssertExtends<A, _B extends A> = true;

// `NostrEvent`: bidirectional. Values flow both ways between SDK and iframe
// (e.g. host returns a signed event from the SDK, parent forwards a literal
// to the iframe), so any field optionality change on either side should
// trigger here.
type _NostrEventCompat = _AssertExtends<NostrEvent, SdkNostrEvent>;
type _NostrEventReverseCompat = _AssertExtends<SdkNostrEvent, NostrEvent>;

// `NosskeyManagerLike`: one-directional only — we require the SDK side to
// be at least as wide as the iframe side. The reverse would forbid the SDK
// from gaining new methods without an iframe release, which is the opposite
// of what we want (SDK is the superset by design).
type _ManagerCompat = _AssertExtends<NosskeyManagerLike, SdkNosskeyManagerLike>;
