/**
 * Cryptographic utilities tests
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aesGcmDecrypt, aesGcmEncrypt, deriveAesGcmKey } from './crypto-utils.js';

describe('crypto-utils', () => {
  let originalCrypto: typeof globalThis.crypto;

  // Web Crypto APIのモック
  beforeEach(() => {
    originalCrypto = globalThis.crypto;

    // Web Crypto APIのモック
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: vi.fn((arr) => {
          arr.fill(99);
          return arr;
        }),
        subtle: {
          importKey: vi.fn(async () => 'mock-key-material'),
          deriveKey: vi.fn(async () => 'mock-derived-key'),
          encrypt: vi.fn(async () => {
            // 32バイトの暗号文 + 16バイトの認証タグを返す
            return new Uint8Array([...new Uint8Array(32).fill(77), ...new Uint8Array(16).fill(88)])
              .buffer;
          }),
          decrypt: vi.fn(async () => {
            // 復号された32バイトのデータを返す
            return new Uint8Array(32).fill(66).buffer;
          }),
        },
      },
      configurable: true,
    });
  });

  // クリーンアップ
  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('deriveAesGcmKey', () => {
    it('PRF秘密からAES-GCM鍵を正しく導出する', async () => {
      const secret = new Uint8Array(32).fill(42);
      const salt = new Uint8Array(16).fill(33);

      const key = await deriveAesGcmKey(secret, salt);

      expect(key).toBe('mock-derived-key');
      expect(crypto.subtle.importKey).toHaveBeenCalledWith('raw', secret, 'HKDF', false, [
        'deriveKey',
      ]);
      expect(crypto.subtle.deriveKey).toHaveBeenCalledWith(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt,
          info: new TextEncoder().encode('nostr-pwk'),
        },
        'mock-key-material',
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });

    it('異なるソルトで異なる鍵が生成される（モック環境での動作確認）', async () => {
      const secret = new Uint8Array(32).fill(42);
      const salt1 = new Uint8Array(16).fill(1);
      const salt2 = new Uint8Array(16).fill(2);

      const key1 = await deriveAesGcmKey(secret, salt1);
      const key2 = await deriveAesGcmKey(secret, salt2);

      // モック環境では同じ値が返されるが、実際の環境では異なる値になる
      expect(key1).toBe('mock-derived-key');
      expect(key2).toBe('mock-derived-key');
      expect(crypto.subtle.deriveKey).toHaveBeenCalledTimes(2);
    });
  });

  describe('aesGcmEncrypt', () => {
    it('平文を正しく暗号化する', async () => {
      const key = 'mock-derived-key';
      const iv = new Uint8Array(12).fill(55);
      const plaintext = new Uint8Array(32).fill(44);

      const result = await aesGcmEncrypt(key as unknown as CryptoKey, iv, plaintext);

      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('tag');
      expect(result.ciphertext).toBeInstanceOf(Uint8Array);
      expect(result.tag).toBeInstanceOf(Uint8Array);
      expect(result.ciphertext.length).toBe(32); // 元のサイズから認証タグを除いた部分
      expect(result.tag.length).toBe(16); // 認証タグのサイズ

      // 暗号化が正しいパラメータで呼ばれたことを確認
      expect(crypto.subtle.encrypt).toHaveBeenCalledWith({ name: 'AES-GCM', iv }, key, plaintext);
    });

    it('暗号文と認証タグが正しく分離される', async () => {
      const key = 'mock-derived-key';
      const iv = new Uint8Array(12).fill(55);
      const plaintext = new Uint8Array(10).fill(44); // より小さなデータサイズでテスト

      // 特定のサイズの暗号文+認証タグを返すようにモックを変更
      vi.spyOn(crypto.subtle, 'encrypt').mockResolvedValueOnce(
        new Uint8Array([...new Uint8Array(10).fill(111), ...new Uint8Array(16).fill(222)]).buffer
      );

      const result = await aesGcmEncrypt(key as unknown as CryptoKey, iv, plaintext);

      // 暗号文部分（最初の10バイト）
      expect(result.ciphertext.length).toBe(10);
      expect(Array.from(result.ciphertext)).toEqual(new Array(10).fill(111));

      // 認証タグ部分（最後の16バイト）
      expect(result.tag.length).toBe(16);
      expect(Array.from(result.tag)).toEqual(new Array(16).fill(222));
    });
  });

  describe('aesGcmDecrypt', () => {
    it('暗号文を正しく復号する', async () => {
      const key = 'mock-derived-key';
      const iv = new Uint8Array(12).fill(55);
      const ciphertext = new Uint8Array(32).fill(77);
      const tag = new Uint8Array(16).fill(88);

      const result = await aesGcmDecrypt(key as unknown as CryptoKey, iv, ciphertext, tag);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);

      // 復号が正しいパラメータで呼ばれたことを確認
      const expectedData = new Uint8Array([...ciphertext, ...tag]);
      expect(crypto.subtle.decrypt).toHaveBeenCalledWith(
        { name: 'AES-GCM', iv },
        key,
        expectedData
      );
    });

    it('暗号文と認証タグが正しく結合される', async () => {
      const key = 'mock-derived-key';
      const iv = new Uint8Array(12).fill(55);
      const ciphertext = new Uint8Array([1, 2, 3, 4, 5]);
      const tag = new Uint8Array([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);

      await aesGcmDecrypt(key as unknown as CryptoKey, iv, ciphertext, tag);

      // 復号時に暗号文と認証タグが正しく結合されることを確認
      const expectedCombined = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      ]);
      expect(crypto.subtle.decrypt).toHaveBeenCalledWith(
        { name: 'AES-GCM', iv },
        key,
        expectedCombined
      );
    });
  });

  describe('暗号化・復号の統合テスト', () => {
    it('暗号化と復号が往復で動作する', async () => {
      // より現実的なWeb Crypto APIの動作をシミュレート
      const mockKeyMaterial = 'mock-key-material';
      const mockDerivedKey = 'mock-derived-key';
      const originalPlaintext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const encryptedData = new Uint8Array([
        ...new Uint8Array(8).fill(100),
        ...new Uint8Array(16).fill(200),
      ]);

      // 鍵導出のモック
      vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue(
        mockKeyMaterial as unknown as CryptoKey
      );
      vi.spyOn(crypto.subtle, 'deriveKey').mockResolvedValue(
        mockDerivedKey as unknown as CryptoKey
      );

      // 暗号化のモック
      vi.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(encryptedData.buffer);

      // 復号のモック（元のデータを返す）
      vi.spyOn(crypto.subtle, 'decrypt').mockResolvedValue(originalPlaintext.buffer);

      // テスト実行
      const secret = new Uint8Array(32).fill(42);
      const salt = new Uint8Array(16).fill(33);
      const iv = new Uint8Array(12).fill(55);

      // 1. 鍵導出
      const key = await deriveAesGcmKey(secret, salt);

      // 2. 暗号化
      const { ciphertext, tag } = await aesGcmEncrypt(key, iv, originalPlaintext);

      // 3. 復号
      const decryptedData = await aesGcmDecrypt(key, iv, ciphertext, tag);

      // 結果の検証
      expect(decryptedData).toEqual(originalPlaintext);
      expect(crypto.subtle.importKey).toHaveBeenCalledTimes(1);
      expect(crypto.subtle.deriveKey).toHaveBeenCalledTimes(1);
      expect(crypto.subtle.encrypt).toHaveBeenCalledTimes(1);
      expect(crypto.subtle.decrypt).toHaveBeenCalledTimes(1);
    });

    it('空のデータでも正しく動作する', async () => {
      const key = 'mock-derived-key';
      const iv = new Uint8Array(12).fill(55);
      const emptyData = new Uint8Array(0);

      // 空データ用のモック
      vi.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(
        new Uint8Array(16).fill(123).buffer // 認証タグのみ
      );
      vi.spyOn(crypto.subtle, 'decrypt').mockResolvedValue(emptyData.buffer);

      const { ciphertext, tag } = await aesGcmEncrypt(key as unknown as CryptoKey, iv, emptyData);

      expect(ciphertext.length).toBe(0);
      expect(tag.length).toBe(16);

      const decryptedData = await aesGcmDecrypt(key as unknown as CryptoKey, iv, ciphertext, tag);
      expect(decryptedData.length).toBe(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('暗号化でエラーが発生した場合は例外を投げる', async () => {
      const key = 'mock-derived-key';
      const iv = new Uint8Array(12).fill(55);
      const plaintext = new Uint8Array(32).fill(44);

      vi.spyOn(crypto.subtle, 'encrypt').mockRejectedValue(new Error('Encryption failed'));

      await expect(aesGcmEncrypt(key as unknown as CryptoKey, iv, plaintext)).rejects.toThrow(
        'Encryption failed'
      );
    });

    it('復号でエラーが発生した場合は例外を投げる', async () => {
      const key = 'mock-derived-key';
      const iv = new Uint8Array(12).fill(55);
      const ciphertext = new Uint8Array(32).fill(77);
      const tag = new Uint8Array(16).fill(88);

      vi.spyOn(crypto.subtle, 'decrypt').mockRejectedValue(new Error('Decryption failed'));

      await expect(aesGcmDecrypt(key as unknown as CryptoKey, iv, ciphertext, tag)).rejects.toThrow(
        'Decryption failed'
      );
    });

    it('鍵導出でエラーが発生した場合は例外を投げる', async () => {
      const secret = new Uint8Array(32).fill(42);
      const salt = new Uint8Array(16).fill(33);

      vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(new Error('Key import failed'));

      await expect(deriveAesGcmKey(secret, salt)).rejects.toThrow('Key import failed');
    });
  });
});
