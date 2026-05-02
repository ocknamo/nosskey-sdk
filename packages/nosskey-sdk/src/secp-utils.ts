/**
 * secp256k1 helpers shared between NIP-44 and NIP-04.
 *
 * @packageDocumentation
 */
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hexToBytes } from './utils.js';

/**
 * Decode a 32-byte (x-only) Nostr public key into the 33-byte compressed form
 * accepted by `secp256k1.getSharedSecret`. Both NIP-04 and NIP-44 fix the
 * parity to even (`0x02` prefix).
 *
 * @throws if `pubkeyHex` is not exactly 64 lowercase/uppercase hex characters.
 */
export function liftEvenXOnly(pubkeyHex: string, label: string): Uint8Array {
  if (pubkeyHex.length !== 64) {
    throw new Error(`${label}: peer public key must be 32 bytes (64 hex chars).`);
  }
  const x = hexToBytes(pubkeyHex);
  const compressed = new Uint8Array(33);
  compressed[0] = 0x02;
  compressed.set(x, 1);
  return compressed;
}

/**
 * secp256k1 ECDH that returns the **x coordinate of the shared point** as a
 * fresh 32-byte buffer. Both NIP-04 and NIP-44 use this `shared_x` value
 * directly (NIP-04 as the AES key, NIP-44 as HKDF input).
 *
 * The result is always a `slice()` (not a `subarray` view) so the caller can
 * mutate or hand it off to a KDF without aliasing into noble's internal output.
 *
 * @throws if `secretKey` is not 32 bytes or `peerPubkeyHex` fails {@link liftEvenXOnly}.
 */
export function ecdhSharedX(
  secretKey: Uint8Array,
  peerPubkeyHex: string,
  label: string
): Uint8Array {
  if (secretKey.length !== 32) {
    throw new Error(`${label}: secret key must be 32 bytes.`);
  }
  const peer = liftEvenXOnly(peerPubkeyHex, label);
  const shared = secp256k1.getSharedSecret(secretKey, peer, true);
  return shared.slice(1, 33);
}
