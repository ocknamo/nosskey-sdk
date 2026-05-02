import { schnorr } from '@noble/curves/secp256k1.js';
import { describe, expect, it } from 'vitest';
import vectors from './__fixtures__/nip44-vectors.json' with { type: 'json' };
import { __nip44Internal, nip44Decrypt, nip44Encrypt } from './nip44.js';
import { bytesToHex, hexToBytes } from './utils.js';

interface ConversationKeyVector {
  sec1: string;
  pub2: string;
  conversation_key: string;
  note?: string;
}
interface MessageKeysVector {
  nonce: string;
  chacha_key: string;
  chacha_nonce: string;
  hmac_key: string;
}
interface EncryptDecryptVector {
  sec1: string;
  sec2: string;
  conversation_key: string;
  nonce: string;
  plaintext: string;
  payload: string;
}
interface InvalidVector {
  sec1: string;
  sec2: string;
  conversation_key?: string;
  nonce?: string;
  plaintext?: string;
  payload?: string;
  note?: string;
}

const v2 = vectors.v2 as {
  valid: {
    get_conversation_key: ConversationKeyVector[];
    get_message_keys: { conversation_key: string; keys: MessageKeysVector[] };
    calc_padded_len: [number, number][];
    encrypt_decrypt: EncryptDecryptVector[];
    encrypt_decrypt_long_msg?: unknown[];
  };
  invalid: {
    encrypt_msg_lengths: number[];
    get_conversation_key: InvalidVector[];
    decrypt: InvalidVector[];
  };
};

function pubkeyHexFromSecret(secHex: string): string {
  return bytesToHex(schnorr.getPublicKey(hexToBytes(secHex)));
}

describe('NIP-44 v2: get_conversation_key', () => {
  for (const [i, vec] of v2.valid.get_conversation_key.entries()) {
    it(`vector ${i}${vec.note ? ` (${vec.note})` : ''}`, () => {
      const sec = hexToBytes(vec.sec1);
      const conv = __nip44Internal.getConversationKey(sec, vec.pub2);
      expect(bytesToHex(conv)).toBe(vec.conversation_key);
    });
  }
});

describe('NIP-44 v2: get_message_keys', () => {
  const conv = hexToBytes(v2.valid.get_message_keys.conversation_key);
  for (const [i, vec] of v2.valid.get_message_keys.keys.entries()) {
    it(`vector ${i}`, () => {
      const { chachaKey, chachaNonce, hmacKey } = __nip44Internal.getMessageKeys(
        conv,
        hexToBytes(vec.nonce)
      );
      expect(bytesToHex(chachaKey)).toBe(vec.chacha_key);
      expect(bytesToHex(chachaNonce)).toBe(vec.chacha_nonce);
      expect(bytesToHex(hmacKey)).toBe(vec.hmac_key);
    });
  }
});

describe('NIP-44 v2: calc_padded_len', () => {
  for (const [unpadded, expected] of v2.valid.calc_padded_len) {
    it(`${unpadded} -> ${expected}`, () => {
      expect(__nip44Internal.calcPaddedLen(unpadded)).toBe(expected);
    });
  }
});

describe('NIP-44 v2: encrypt_decrypt', () => {
  for (const [i, vec] of v2.valid.encrypt_decrypt.entries()) {
    it(`vector ${i}: encrypt produces canonical payload`, () => {
      const sec1 = hexToBytes(vec.sec1);
      const pub2 = pubkeyHexFromSecret(vec.sec2);
      const payload = nip44Encrypt(vec.plaintext, sec1, pub2, hexToBytes(vec.nonce));
      expect(payload).toBe(vec.payload);
    });
    it(`vector ${i}: decrypt recovers plaintext`, () => {
      const sec2 = hexToBytes(vec.sec2);
      const pub1 = pubkeyHexFromSecret(vec.sec1);
      expect(nip44Decrypt(vec.payload, sec2, pub1)).toBe(vec.plaintext);
    });
  }
});

describe('NIP-44 v2: invalid plaintext lengths reject', () => {
  // Use any valid keypair; we expect failure before the crypto runs in some
  // cases (length 0 / >65535) and after in others — just assert it throws.
  const sec = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001');
  const pubHex = pubkeyHexFromSecret(
    '0000000000000000000000000000000000000000000000000000000000000002'
  );
  for (const len of v2.invalid.encrypt_msg_lengths) {
    it(`length ${len} throws`, () => {
      const plaintext = len === 0 ? '' : 'a'.repeat(len);
      expect(() => nip44Encrypt(plaintext, sec, pubHex)).toThrow();
    });
  }
});

describe('NIP-44 v2: invalid get_conversation_key vectors throw', () => {
  for (const [i, vec] of v2.invalid.get_conversation_key.entries()) {
    it(`vector ${i}${vec.note ? ` (${vec.note})` : ''}`, () => {
      expect(() => {
        const sec = hexToBytes(vec.sec1);
        // Some invalid vectors expose `pub2` instead of pairing two secrets.
        // biome-ignore lint/suspicious/noExplicitAny: heterogeneous fixture shape
        const pub2 = (vec as any).pub2 ?? pubkeyHexFromSecret((vec as any).sec2);
        __nip44Internal.getConversationKey(sec, pub2);
      }).toThrow();
    });
  }
});

describe('NIP-44 v2: invalid decrypt vectors throw', () => {
  for (const [i, vec] of v2.invalid.decrypt.entries()) {
    it(`vector ${i}${vec.note ? ` (${vec.note})` : ''}`, () => {
      // Skip vectors that don't carry both keys + payload (shape varies).
      if (!vec.payload || !vec.sec1 || !vec.sec2) return;
      const payload = vec.payload;
      const sec2 = hexToBytes(vec.sec2);
      const pub1 = pubkeyHexFromSecret(vec.sec1);
      expect(() => nip44Decrypt(payload, sec2, pub1)).toThrow();
    });
  }
});

describe('NIP-44 v2: roundtrip with random nonce', () => {
  it('encrypts and decrypts arbitrary text', () => {
    const aliceSec = hexToBytes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const bobSec = hexToBytes('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const alicePub = bytesToHex(schnorr.getPublicKey(aliceSec));
    const bobPub = bytesToHex(schnorr.getPublicKey(bobSec));

    const payload = nip44Encrypt('hello, world! こんにちは 🌍', aliceSec, bobPub);
    expect(nip44Decrypt(payload, bobSec, alicePub)).toBe('hello, world! こんにちは 🌍');
  });
});
