import { schnorr } from '@noble/curves/secp256k1.js';
import { describe, expect, it } from 'vitest';
import { __nip04Internal, nip04Decrypt, nip04Encrypt } from './nip04.js';
import { bytesToHex, hexToBytes } from './utils.js';

describe('NIP-04', () => {
  const aliceSec = hexToBytes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const bobSec = hexToBytes('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  const alicePub = bytesToHex(schnorr.getPublicKey(aliceSec));
  const bobPub = bytesToHex(schnorr.getPublicKey(bobSec));

  it('shared X is symmetric', () => {
    const aShared = __nip04Internal.getSharedX(aliceSec, bobPub);
    const bShared = __nip04Internal.getSharedX(bobSec, alicePub);
    expect(bytesToHex(aShared)).toBe(bytesToHex(bShared));
  });

  it('roundtrip ASCII', () => {
    const payload = nip04Encrypt('hello, nostr!', aliceSec, bobPub);
    expect(payload).toMatch(/^[A-Za-z0-9+/=]+\?iv=[A-Za-z0-9+/=]+$/);
    expect(nip04Decrypt(payload, bobSec, alicePub)).toBe('hello, nostr!');
  });

  it('roundtrip multi-byte UTF-8', () => {
    const text = 'こんにちは 🌸 Прив!';
    const payload = nip04Encrypt(text, aliceSec, bobPub);
    expect(nip04Decrypt(payload, bobSec, alicePub)).toBe(text);
  });

  it('encrypts deterministically with explicit IV', () => {
    const iv = new Uint8Array(16);
    const a = nip04Encrypt('hi', aliceSec, bobPub, iv);
    const b = nip04Encrypt('hi', aliceSec, bobPub, iv);
    expect(a).toBe(b);
  });

  it('rejects payload missing ?iv= separator', () => {
    expect(() => nip04Decrypt('not-a-payload', aliceSec, bobPub)).toThrow(/separator/);
  });

  it('rejects IV of wrong length', () => {
    const iv = new Uint8Array(8);
    expect(() => nip04Encrypt('x', aliceSec, bobPub, iv)).toThrow();
  });

  it('rejects 64-char-mismatch peer pubkey', () => {
    expect(() => nip04Encrypt('x', aliceSec, 'short')).toThrow();
  });

  it('rejects non-hex peer pubkey of correct length', () => {
    // Same length as a real pubkey but contains non-hex characters.
    const fakePub = 'g'.repeat(64);
    expect(() => nip04Encrypt('x', aliceSec, fakePub)).toThrow(/64 hex characters/);
  });
});
