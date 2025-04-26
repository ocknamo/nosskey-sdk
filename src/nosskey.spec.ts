import { bytesToHex } from '@noble/hashes/utils';
import { seckeySigner } from 'rx-nostr-crypto';
/**
 * Nosskey SDK テスト
 * @packageDocumentation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWKManager } from './nosskey.js';
import type { NostrEvent, PWKBlob } from './types.js';

// rx-nostr-crypto のモック
vi.mock('rx-nostr-crypto', () => {
  return {
    seckeySigner: vi.fn(() => ({
      signEvent: vi.fn(async (event) => ({
        ...event,
        id: 'test-event-id',
        sig: 'test-signature',
      })),
      getPublicKey: vi.fn(async () => 'test-pubkey'),
    })),
  };
});

describe('PWKManager', () => {
  // WebAuthn APIのモック
  const mockPrfResult = new Uint8Array(32).fill(42).buffer;
  const mockCredentialId = new Uint8Array(16).fill(1);
  let originalCrypto: typeof globalThis.crypto;
  let originalCredentials: typeof globalThis.navigator.credentials;

  // モックセットアップ
  beforeEach(() => {
    originalCrypto = globalThis.crypto;
    originalCredentials = globalThis.navigator.credentials;

    // PRF出力を含むモックの応答
    const mockCredential = {
      id: 'mock-credential-id',
      rawId: mockCredentialId.buffer,
      type: 'public-key',
      getClientExtensionResults: vi.fn(() => ({
        prf: {
          results: {
            first: mockPrfResult,
          },
        },
      })),
    };

    // Navigator Credentialsのモック
    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: {
        create: vi.fn(async () => mockCredential),
        get: vi.fn(async () => mockCredential),
      },
      configurable: true,
    });

    // Web Crypto APIのモック
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: vi.fn((arr) => {
          arr.fill(99);
          return arr;
        }),
        subtle: {
          importKey: vi.fn(async () => 'mock-key'),
          deriveKey: vi.fn(async () => 'mock-derived-key'),
          encrypt: vi.fn(async () => {
            // 32バイトの暗号文 + 16バイトのタグを返す
            return new Uint8Array([...new Uint8Array(32).fill(77), ...new Uint8Array(16).fill(88)])
              .buffer;
          }),
          decrypt: vi.fn(async () => {
            // 復号された32バイトの秘密鍵を返す
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
    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: originalCredentials,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('isPrfSupported', () => {
    it('PRF拡張が利用可能な場合にtrueを返す', async () => {
      const pwkManager = new PWKManager();
      const result = await pwkManager.isPrfSupported();
      expect(result).toBe(true);
      expect(navigator.credentials.get).toHaveBeenCalled();
    });

    it('例外発生時にfalseを返す', async () => {
      // エラーを投げるようにモックを変更
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => {
            throw new Error('Not supported');
          }),
        },
        configurable: true,
      });

      const pwkManager = new PWKManager();
      const result = await pwkManager.isPrfSupported();
      expect(result).toBe(false);
    });
  });

  describe('createPasskey', () => {
    it('パスキーを作成してCredentialIDを返す', async () => {
      const pwkManager = new PWKManager();
      const credentialId = await pwkManager.createPasskey();

      expect(credentialId).toBeInstanceOf(Uint8Array);
      expect(credentialId.length).toBeGreaterThan(0);
      expect(navigator.credentials.create).toHaveBeenCalled();
    });
  });

  describe('importNostrKey', () => {
    it('既存のNostr秘密鍵をパスキーでラップできる', async () => {
      const pwkManager = new PWKManager();
      const credentialId = new Uint8Array(16).fill(1);
      const secretKey = new Uint8Array(32).fill(55);

      const result = await pwkManager.importNostrKey(credentialId, secretKey);

      expect(result).toHaveProperty('pwkBlob');
      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('publicKey');
      expect(result.pwkBlob.v).toBe(1);
      expect(result.pwkBlob.alg).toBe('aes-gcm-256');
      expect(result.publicKey).toBe('test-pubkey');

      expect(crypto.subtle.encrypt).toHaveBeenCalled();
      expect(seckeySigner).toHaveBeenCalled();
    });
  });

  describe('generateNostrKey', () => {
    it('新しいNostr秘密鍵を生成してパスキーでラップできる', async () => {
      const pwkManager = new PWKManager();
      const credentialId = new Uint8Array(16).fill(1);

      const result = await pwkManager.generateNostrKey(credentialId);

      expect(result).toHaveProperty('pwkBlob');
      expect(result.pwkBlob.v).toBe(1);
      expect(result.pwkBlob.alg).toBe('aes-gcm-256');
      expect(result.publicKey).toBe('test-pubkey');

      expect(crypto.getRandomValues).toHaveBeenCalled();
    });
  });

  describe('directPrfToNostrKey', () => {
    it('PRF値を直接Nostrシークレットキーとして使用できる', async () => {
      const pwkManager = new PWKManager();
      const credentialId = new Uint8Array(16).fill(1);

      const result = await pwkManager.directPrfToNostrKey(credentialId);

      expect(result).toHaveProperty('pwkBlob');
      expect(result.pwkBlob.v).toBe(1);
      expect(result.pwkBlob.alg).toBe('prf-direct');
      expect(result.pwkBlob).toHaveProperty('credentialId');
      expect(result.publicKey).toBe('test-pubkey');
    });

    it('PRF値がゼロの場合はエラーを投げる', async () => {
      const pwkManager = new PWKManager();
      const credentialId = new Uint8Array(16).fill(1);

      // PRFの結果がすべて0の場合をモック
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => ({
            getClientExtensionResults: vi.fn(() => ({
              prf: {
                results: {
                  first: new Uint8Array(32).fill(0).buffer,
                },
              },
            })),
          })),
        },
        configurable: true,
      });

      await expect(pwkManager.directPrfToNostrKey(credentialId)).rejects.toThrow(
        'Invalid PRF output'
      );
    });
  });

  describe('signEvent', () => {
    it('暗号化された秘密鍵を使ってイベントに署名できる', async () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1,
        alg: 'aes-gcm-256',
        salt: bytesToHex(new Uint8Array(16).fill(11)),
        iv: bytesToHex(new Uint8Array(12).fill(22)),
        ct: bytesToHex(new Uint8Array(32).fill(33)),
        tag: bytesToHex(new Uint8Array(16).fill(44)),
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      const signedEvent = await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId, {
        tags: [['t', 'test']],
      });

      expect(signedEvent).toHaveProperty('id', 'test-event-id');
      expect(signedEvent).toHaveProperty('sig', 'test-signature');
      expect(crypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('PRF直接使用方式でイベントに署名できる', async () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1 as const, // const assertion to match the exact type
        alg: 'prf-direct' as const, // const assertion to match the exact type
        credentialId: bytesToHex(mockCredentialId),
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr with PRF!',
        tags: [],
      };

      const signedEvent = await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId);

      expect(signedEvent).toHaveProperty('id', 'test-event-id');
      expect(signedEvent).toHaveProperty('sig', 'test-signature');
      // PRF直接使用では復号処理は行われない
      expect(crypto.subtle.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('clearKey', () => {
    it('秘密鍵のバッファをゼロで埋める', () => {
      const pwkManager = new PWKManager();
      const key = new Uint8Array(32).fill(123);
      pwkManager.clearKey(key);

      // すべての要素が0になっていることを確認
      expect(Array.from(key).every((byte) => byte === 0)).toBe(true);
    });
  });
});
