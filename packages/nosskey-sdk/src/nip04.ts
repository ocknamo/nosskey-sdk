/**
 * NIP-04 encrypted direct messages (legacy `kind: 4`).
 *
 * Spec: https://github.com/nostr-protocol/nips/blob/master/04.md
 *
 * NIP-04 uses AES-256-CBC keyed directly with the X coordinate of the
 * secp256k1 ECDH shared point. Payload format: `<base64(ciphertext)>?iv=<base64(iv)>`.
 *
 * @packageDocumentation
 */
import { cbc } from '@noble/ciphers/aes.js';
import { ecdhSharedX } from './secp-utils.js';

const IV_LEN = 16;

function getSharedX(secretKey: Uint8Array, peerPubkeyHex: string): Uint8Array {
  return ecdhSharedX(secretKey, peerPubkeyHex, 'NIP-04');
}

function base64Encode(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64Decode(str: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(str, 'base64'));
}

/**
 * Encrypt a plaintext for NIP-04 kind:4 DM.
 *
 * @param plaintext UTF-8 plaintext.
 * @param ourSecretKey Sender's 32-byte private key.
 * @param peerPubkeyHex Recipient's 32-byte x-only public key (hex).
 * @param ivOverride Optional 16-byte IV (deterministic testing).
 * @returns NIP-04 payload `<base64(ct)>?iv=<base64(iv)>`.
 */
export function nip04Encrypt(
  plaintext: string,
  ourSecretKey: Uint8Array,
  peerPubkeyHex: string,
  ivOverride?: Uint8Array
): string {
  let iv: Uint8Array;
  if (ivOverride) {
    if (ivOverride.length !== IV_LEN) {
      throw new Error('NIP-04: IV override must be 16 bytes.');
    }
    iv = ivOverride;
  } else {
    iv = new Uint8Array(IV_LEN);
    crypto.getRandomValues(iv);
  }
  const sharedX = getSharedX(ourSecretKey, peerPubkeyHex);
  const ciphertext = cbc(sharedX, iv).encrypt(new TextEncoder().encode(plaintext));
  return `${base64Encode(ciphertext)}?iv=${base64Encode(iv)}`;
}

/**
 * Decrypt a NIP-04 payload.
 *
 * @param payload `<base64(ct)>?iv=<base64(iv)>`.
 * @param ourSecretKey Recipient's 32-byte private key.
 * @param peerPubkeyHex Sender's 32-byte x-only public key (hex).
 */
export function nip04Decrypt(
  payload: string,
  ourSecretKey: Uint8Array,
  peerPubkeyHex: string
): string {
  const sep = payload.indexOf('?iv=');
  if (sep < 0) {
    throw new Error('NIP-04: payload missing "?iv=" separator.');
  }
  const ctB64 = payload.slice(0, sep);
  const ivB64 = payload.slice(sep + 4);
  const ciphertext = base64Decode(ctB64);
  const iv = base64Decode(ivB64);
  if (iv.length !== IV_LEN) {
    throw new Error('NIP-04: IV must be 16 bytes.');
  }
  const sharedX = getSharedX(ourSecretKey, peerPubkeyHex);
  const plain = cbc(sharedX, iv).decrypt(ciphertext);
  return new TextDecoder().decode(plain);
}

/** @internal Test hooks. */
export const __nip04Internal = {
  getSharedX,
};
