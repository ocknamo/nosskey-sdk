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

  describe('create', () => {
    it('新しいPWKBlobを作成できる', async () => {
      const pwkManager = new PWKManager();
      const result = await pwkManager.create();

      // 戻り値の検証
      expect(result).toHaveProperty('pwkBlob');
      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('publicKey');
      expect(result.pwkBlob.v).toBe(1);
      expect(result.pwkBlob.alg).toBe('aes-gcm-256');
      expect(result.publicKey).toBe('test-pubkey');

      // APIコールの検証
      expect(navigator.credentials.create).toHaveBeenCalled();
      expect(crypto.subtle.encrypt).toHaveBeenCalled();
      expect(seckeySigner).toHaveBeenCalled();
    });

    it('外部から渡された秘密鍵を使用できる', async () => {
      const pwkManager = new PWKManager();
      const secretKey = new Uint8Array(32).fill(55);
      const result = await pwkManager.create({ secretKey });

      expect(result).toHaveProperty('pwkBlob');
      expect(seckeySigner).toHaveBeenCalled();
      // 注: 実際のseckeySignerの引数を検証するにはもっと複雑なモックが必要
    });
  });

  describe('signEvent', () => {
    it('イベントに署名できる', async () => {
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
