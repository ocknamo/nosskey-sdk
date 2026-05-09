/**
 * NIP-17 sealed direct message helpers, scoped to the parent-sample app.
 *
 * Spec:
 * - https://github.com/nostr-protocol/nips/blob/master/17.md
 * - https://github.com/nostr-protocol/nips/blob/master/59.md (gift wrap)
 *
 * Three-layer construction per send:
 *   kind:14  rumor       — chat message, NEVER signed (no `sig`)
 *   kind:13  seal        — NIP-44 encrypts the rumor JSON, signed by sender
 *   kind:1059 gift wrap  — NIP-44 encrypts the seal JSON with an EPHEMERAL
 *                          keypair, signed by that ephemeral key
 *
 * Only the seal step needs the user's Nosskey (NIP-44 encrypt + signEvent),
 * so it is delegated to callbacks the caller wires up against the iframe
 * client. The gift-wrap step uses a throwaway secp256k1 keypair generated
 * locally with `@noble/curves`.
 */
import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { type NostrEvent, bytesToHex, hexToBytes, nip44Encrypt } from 'nosskey-sdk';

const KIND_CHAT_MESSAGE = 14;
const KIND_SEAL = 13;
const KIND_GIFT_WRAP = 1059;

/** NIP-59 §3: jitter `created_at` up to two days into the past. */
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

/** Random `created_at` between `now - TWO_DAYS_SECONDS` and `now`. */
export function jitteredTimestamp(now = Math.floor(Date.now() / 1000)): number {
  return now - Math.floor(Math.random() * TWO_DAYS_SECONDS);
}

interface CanonicalDraft {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

/** NIP-01 event id: sha256(JSON([0, pubkey, created_at, kind, tags, content])). */
function computeEventId(draft: CanonicalDraft): string {
  const serialized = JSON.stringify([
    0,
    draft.pubkey,
    draft.created_at,
    draft.kind,
    draft.tags,
    draft.content,
  ]);
  return bytesToHex(sha256(new TextEncoder().encode(serialized)));
}

/**
 * Build kind:14 chat-message rumor. Rumors carry an `id` for the seal layer
 * to reference but are deliberately left unsigned.
 */
export function buildRumor(senderPubkey: string, peerPubkey: string, content: string): NostrEvent {
  const draft: CanonicalDraft = {
    pubkey: senderPubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: KIND_CHAT_MESSAGE,
    tags: [['p', peerPubkey]],
    content,
  };
  return { ...draft, id: computeEventId(draft) };
}

/**
 * Schnorr-sign a draft event with the given ephemeral secret. Used for the
 * kind:1059 gift wrap, whose pubkey is intentionally unrelated to the
 * sender's Nosskey.
 */
export function signEphemeralEvent(
  draft: { kind: number; created_at: number; tags: string[][]; content: string },
  ephemeralSecret: Uint8Array
): NostrEvent {
  const pubkey = bytesToHex(schnorr.getPublicKey(ephemeralSecret));
  const id = computeEventId({ ...draft, pubkey });
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), ephemeralSecret));
  return { ...draft, pubkey, id, sig };
}

export interface SendNip17DmInputs {
  senderPubkey: string;
  peerPubkey: string;
  plaintext: string;
  /** NIP-44 encrypt with the user's Nosskey (typically iframe nip44.encrypt). */
  sealEncrypt: (peer: string, plain: string) => Promise<string>;
  /** Sign a kind:13 draft with the user's Nosskey (typically iframe signEvent). */
  signSeal: (draft: NostrEvent) => Promise<NostrEvent>;
  /** Publish the finalized kind:1059 to a relay. */
  publish: (event: NostrEvent) => Promise<void>;
}

export interface Nip17SendResult {
  giftWrap: NostrEvent;
  ephemeralPubkey: string;
}

/**
 * Build and publish a NIP-17 sealed DM addressed to `peerPubkey`.
 *
 * Sends a single gift wrap to the peer. NIP-17 also lets a sender wrap a
 * copy to themselves to keep an outbox; that's intentionally skipped here —
 * verifying receipt in another client only requires the recipient copy.
 */
export async function sendNip17Dm(inputs: SendNip17DmInputs): Promise<Nip17SendResult> {
  const { senderPubkey, peerPubkey, plaintext, sealEncrypt, signSeal, publish } = inputs;

  const rumor = buildRumor(senderPubkey, peerPubkey, plaintext);

  const sealCiphertext = await sealEncrypt(peerPubkey, JSON.stringify(rumor));
  const seal = await signSeal({
    kind: KIND_SEAL,
    content: sealCiphertext,
    tags: [],
    created_at: jitteredTimestamp(),
  });

  const ephemeralSecret = schnorr.utils.randomSecretKey();
  const ephemeralPubkey = bytesToHex(schnorr.getPublicKey(ephemeralSecret));

  const wrapCiphertext = nip44Encrypt(JSON.stringify(seal), ephemeralSecret, peerPubkey);

  const giftWrap = signEphemeralEvent(
    {
      kind: KIND_GIFT_WRAP,
      content: wrapCiphertext,
      tags: [['p', peerPubkey]],
      created_at: jitteredTimestamp(),
    },
    ephemeralSecret
  );

  await publish(giftWrap);

  return { giftWrap, ephemeralPubkey };
}
