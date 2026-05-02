/**
 * NIP-44 v2 message encryption.
 *
 * Spec: https://github.com/nostr-protocol/nips/blob/master/44.md
 *
 * @packageDocumentation
 */
import { chacha20 } from '@noble/ciphers/chacha.js';
import { expand as hkdfExpand, extract as hkdfExtract } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ecdhSharedX } from './secp-utils.js';
import { base64ToBytes, bytesToBase64, bytesToHex } from './utils.js';

const VERSION = 0x02;
const MIN_PLAINTEXT_LEN = 1;
const MAX_PLAINTEXT_LEN = 65535;
const SALT = new TextEncoder().encode('nip44-v2');

/** Conversation key length in bytes. */
const CONVERSATION_KEY_LEN = 32;
/** Total length expanded from HKDF for one message: chacha key + nonce + hmac key. */
const MESSAGE_KEYS_LEN = 76;
/** Random nonce length used by the spec. */
const NONCE_LEN = 32;
/** Length of the HMAC tag in bytes. */
const MAC_LEN = 32;

interface MessageKeys {
  chachaKey: Uint8Array;
  chachaNonce: Uint8Array;
  hmacKey: Uint8Array;
}

/**
 * Compute the conversation key shared between two NIP-44 peers.
 *
 * @internal Intentionally not re-exported from the SDK barrel: the conversation
 * key is a long-lived secret derived from ECDH, and exposing it lets callers
 * encrypt arbitrary messages without re-deriving from the private key. Use
 * {@link nip44Encrypt} / {@link nip44Decrypt} instead.
 */
function getConversationKey(secretKey: Uint8Array, peerPubkeyHex: string): Uint8Array {
  const sharedX = ecdhSharedX(secretKey, peerPubkeyHex, 'NIP-44');
  return hkdfExtract(sha256, sharedX, SALT);
}

/**
 * Derive per-message keys (chacha key, chacha nonce, hmac key) from the
 * conversation key.
 *
 * @internal Intentionally not re-exported. Returning the chacha key and HMAC
 * key in raw bytes invites nonce reuse and key-mixing footguns from callers
 * who don't know the protocol details.
 */
function getMessageKeys(conversationKey: Uint8Array, nonce: Uint8Array): MessageKeys {
  if (conversationKey.length !== CONVERSATION_KEY_LEN) {
    throw new Error('NIP-44: conversation key must be 32 bytes.');
  }
  if (nonce.length !== NONCE_LEN) {
    throw new Error('NIP-44: nonce must be 32 bytes.');
  }
  const okm = hkdfExpand(sha256, conversationKey, nonce, MESSAGE_KEYS_LEN);
  return {
    chachaKey: okm.subarray(0, 32),
    chachaNonce: okm.subarray(32, 44),
    hmacKey: okm.subarray(44, 76),
  };
}

/**
 * Padded length bucket used by the spec's `calc_padded_len`.
 *
 * The early `<= 32` return is not just an optimisation — it also keeps
 * `Math.log2(unpaddedLen - 1)` away from `log2(0) = -Infinity` for
 * `unpaddedLen === 1`. Reorder at your peril.
 */
function calcPaddedLen(unpaddedLen: number): number {
  if (unpaddedLen < 1) {
    throw new Error('NIP-44: plaintext length must be >= 1.');
  }
  if (unpaddedLen <= 32) return 32;
  const nextPower = 1 << (Math.floor(Math.log2(unpaddedLen - 1)) + 1);
  const chunk = nextPower <= 256 ? 32 : nextPower / 8;
  return chunk * (Math.floor((unpaddedLen - 1) / chunk) + 1);
}

function pad(plaintext: string): Uint8Array {
  const utf8 = new TextEncoder().encode(plaintext);
  const len = utf8.length;
  if (len < MIN_PLAINTEXT_LEN || len > MAX_PLAINTEXT_LEN) {
    throw new Error(`NIP-44: plaintext length must be between 1 and ${MAX_PLAINTEXT_LEN} bytes.`);
  }
  const padded = new Uint8Array(2 + calcPaddedLen(len));
  // Big-endian uint16 length prefix.
  padded[0] = (len >>> 8) & 0xff;
  padded[1] = len & 0xff;
  padded.set(utf8, 2);
  return padded;
}

function unpad(padded: Uint8Array): string {
  if (padded.length < 2) {
    throw new Error('NIP-44: padded payload is too short.');
  }
  const len = (padded[0] << 8) | padded[1];
  if (len < MIN_PLAINTEXT_LEN || len > MAX_PLAINTEXT_LEN) {
    throw new Error('NIP-44: invalid plaintext length.');
  }
  if (padded.length !== 2 + calcPaddedLen(len)) {
    throw new Error('NIP-44: padded payload length mismatch.');
  }
  const text = padded.subarray(2, 2 + len);
  return new TextDecoder().decode(text);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hmacWithAad(key: Uint8Array, aad: Uint8Array, message: Uint8Array): Uint8Array {
  if (aad.length !== 32) {
    throw new Error('NIP-44: AAD must be 32 bytes.');
  }
  const buf = new Uint8Array(aad.length + message.length);
  buf.set(aad, 0);
  buf.set(message, aad.length);
  return hmac(sha256, key, buf);
}

function decodePayload(str: string): Uint8Array {
  // NIP-44 reserves a leading '#' to mark a future, non-base64 versioned
  // wire format; reject explicitly so it surfaces as a protocol error rather
  // than as a base64 parse failure.
  if (str.length === 0) {
    throw new Error('NIP-44: payload is empty.');
  }
  if (str.startsWith('#')) {
    throw new Error('NIP-44: unsupported version prefix "#".');
  }
  return base64ToBytes(str);
}

/**
 * Encrypt a plaintext message with NIP-44 v2.
 *
 * @param plaintext Message to encrypt (UTF-8, 1..65535 bytes).
 * @param ourSecretKey Sender's 32-byte private key.
 * @param peerPubkeyHex Recipient's 32-byte x-only public key (hex).
 * @param nonceOverride Optional 32-byte nonce — for tests / known-answer vectors.
 * @returns Base64-encoded NIP-44 v2 payload.
 */
export function nip44Encrypt(
  plaintext: string,
  ourSecretKey: Uint8Array,
  peerPubkeyHex: string,
  nonceOverride?: Uint8Array
): string {
  const conversationKey = getConversationKey(ourSecretKey, peerPubkeyHex);
  let nonce: Uint8Array;
  if (nonceOverride) {
    if (nonceOverride.length !== NONCE_LEN) {
      throw new Error('NIP-44: nonce override must be 32 bytes.');
    }
    nonce = nonceOverride;
  } else {
    nonce = new Uint8Array(NONCE_LEN);
    crypto.getRandomValues(nonce);
  }
  const { chachaKey, chachaNonce, hmacKey } = getMessageKeys(conversationKey, nonce);
  const padded = pad(plaintext);
  const ciphertext = chacha20(chachaKey, chachaNonce, padded);
  const mac = hmacWithAad(hmacKey, nonce, ciphertext);

  const payload = new Uint8Array(1 + NONCE_LEN + ciphertext.length + MAC_LEN);
  payload[0] = VERSION;
  payload.set(nonce, 1);
  payload.set(ciphertext, 1 + NONCE_LEN);
  payload.set(mac, 1 + NONCE_LEN + ciphertext.length);
  return bytesToBase64(payload);
}

/**
 * Decrypt a NIP-44 v2 payload.
 *
 * @param payload Base64-encoded payload as produced by {@link nip44Encrypt}.
 * @param ourSecretKey Recipient's 32-byte private key.
 * @param peerPubkeyHex Sender's 32-byte x-only public key (hex).
 */
export function nip44Decrypt(
  payload: string,
  ourSecretKey: Uint8Array,
  peerPubkeyHex: string
): string {
  const bytes = decodePayload(payload);
  if (bytes.length < 1 + NONCE_LEN + 1 + MAC_LEN) {
    throw new Error('NIP-44: payload is too short.');
  }
  const version = bytes[0];
  if (version !== VERSION) {
    throw new Error(`NIP-44: unsupported version ${version}.`);
  }
  const nonce = bytes.subarray(1, 1 + NONCE_LEN);
  const ciphertext = bytes.subarray(1 + NONCE_LEN, bytes.length - MAC_LEN);
  const mac = bytes.subarray(bytes.length - MAC_LEN);

  const conversationKey = getConversationKey(ourSecretKey, peerPubkeyHex);
  const { chachaKey, chachaNonce, hmacKey } = getMessageKeys(conversationKey, nonce);

  const expectedMac = hmacWithAad(hmacKey, nonce, ciphertext);
  if (!constantTimeEqual(expectedMac, mac)) {
    throw new Error('NIP-44: invalid MAC.');
  }

  const padded = chacha20(chachaKey, chachaNonce, ciphertext);
  return unpad(padded);
}

/** @internal Exposed for tests and key-export tooling. */
export const __nip44Internal = {
  getConversationKey,
  getMessageKeys,
  calcPaddedLen,
  pad,
  unpad,
  conversationKeyHex: (sk: Uint8Array, peerHex: string) =>
    bytesToHex(getConversationKey(sk, peerHex)),
};
