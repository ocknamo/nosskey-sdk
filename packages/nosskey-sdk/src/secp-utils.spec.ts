import { describe, expect, it } from 'vitest';
import { ecdhSharedX, liftEvenXOnly } from './secp-utils.js';

// secp256k1 ジェネレータ点 G の x 座標。0x02 プレフィックスを付けると曲線上の有効な点になる。
const VALID_PUBKEY_X = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

describe('secp-utils', () => {
  describe('liftEvenXOnly', () => {
    it('64文字の hex を 33バイトの圧縮形式に変換し、偶数パリティ(0x02)を付与すること', () => {
      const result = liftEvenXOnly(VALID_PUBKEY_X, 'test');
      expect(result.length).toBe(33);
      expect(result[0]).toBe(0x02);
    });

    it('大文字の hex も受け付けること', () => {
      const result = liftEvenXOnly(VALID_PUBKEY_X.toUpperCase(), 'test');
      expect(result.length).toBe(33);
    });

    it('非hex文字を含む64文字でエラーを投げること', () => {
      expect(() => liftEvenXOnly('g'.repeat(64), 'test')).toThrow(
        'test: peer public key must be 64 hex characters.'
      );
    });

    it('64文字未満でエラーを投げること', () => {
      expect(() => liftEvenXOnly('ab', 'test')).toThrow(
        'peer public key must be 64 hex characters.'
      );
    });

    it('64文字超でエラーを投げること', () => {
      expect(() => liftEvenXOnly(`${VALID_PUBKEY_X}00`, 'test')).toThrow(
        'peer public key must be 64 hex characters.'
      );
    });
  });

  describe('ecdhSharedX', () => {
    it('有効な秘密鍵と公開鍵で 32バイトの shared_x を返すこと', () => {
      const secretKey = new Uint8Array(32).fill(1);
      const result = ecdhSharedX(secretKey, VALID_PUBKEY_X, 'test');
      expect(result instanceof Uint8Array).toBe(true);
      expect(result.length).toBe(32);
    });

    it('同じ入力に対して決定的な結果を返すこと', () => {
      const secretKey = new Uint8Array(32).fill(1);
      const a = ecdhSharedX(secretKey, VALID_PUBKEY_X, 'test');
      const b = ecdhSharedX(secretKey, VALID_PUBKEY_X, 'test');
      expect(Array.from(a)).toEqual(Array.from(b));
    });

    it('秘密鍵が32バイトでない場合にエラーを投げること', () => {
      expect(() => ecdhSharedX(new Uint8Array(31), VALID_PUBKEY_X, 'test')).toThrow(
        'test: secret key must be 32 bytes.'
      );
      expect(() => ecdhSharedX(new Uint8Array(33), VALID_PUBKEY_X, 'test')).toThrow(
        'secret key must be 32 bytes.'
      );
    });

    it('公開鍵が不正な場合に liftEvenXOnly 経由でエラーを投げること', () => {
      const secretKey = new Uint8Array(32).fill(1);
      expect(() => ecdhSharedX(secretKey, 'g'.repeat(64), 'test')).toThrow(
        'peer public key must be 64 hex characters.'
      );
    });
  });
});
