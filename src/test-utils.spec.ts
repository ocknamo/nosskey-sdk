/**
 * Test utilities tests
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';
import { registerDummyPasskey } from './test-utils.js';

describe('test-utils', () => {
  describe('registerDummyPasskey', () => {
    it('PublicKeyCredential互換オブジェクトを返す', async () => {
      const credential = await registerDummyPasskey('test-user');

      expect(credential).toBeDefined();
      expect(credential.id).toBe('dummy-credential-id');
      expect(credential.type).toBe('public-key');
    });

    it('rawIdはUint8Arrayで長さ32', async () => {
      const credential = await registerDummyPasskey('test-user');

      expect(credential.rawId).toBeInstanceOf(Uint8Array);
      expect((credential.rawId as unknown as Uint8Array).length).toBe(32);
    });

    it('responseに必要なダミーメソッドが含まれる', async () => {
      const credential = await registerDummyPasskey('test-user');
      const response = credential.response as AuthenticatorAttestationResponse & {
        signature: Uint8Array;
      };

      expect(response.clientDataJSON).toBeInstanceOf(Uint8Array);
      expect(response.attestationObject).toBeInstanceOf(Uint8Array);
      expect(response.signature).toBeInstanceOf(Uint8Array);
      expect(response.signature.length).toBe(64);
      expect(response.getPublicKeyAlgorithm()).toBe(-7);
      expect(response.getTransports()).toEqual(['internal']);
    });

    it('異なる呼び出しでも決定的な結果を返す', async () => {
      const credential1 = await registerDummyPasskey('user-1');
      const credential2 = await registerDummyPasskey('user-2');

      // ダミー実装は userId を使わない決定的な値を返す
      expect(credential1.id).toBe(credential2.id);
      expect(Array.from(credential1.rawId as unknown as Uint8Array)).toEqual(
        Array.from(credential2.rawId as unknown as Uint8Array)
      );
    });
  });
});
