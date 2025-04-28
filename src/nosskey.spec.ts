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
  const mockPrfResultValue = 42;
  const mockPrfResult = new Uint8Array(32).fill(mockPrfResultValue).buffer;
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

  describe('exportNostrKey', () => {
    it('暗号化された秘密鍵をエクスポートできる（aes-gcm-256）', async () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1,
        alg: 'aes-gcm-256',
        salt: bytesToHex(new Uint8Array(16).fill(11)),
        iv: bytesToHex(new Uint8Array(12).fill(22)),
        ct: bytesToHex(new Uint8Array(32).fill(33)),
        tag: bytesToHex(new Uint8Array(16).fill(44)),
      };

      const secretKey = await pwkManager.exportNostrKey(mockPwkBlob, mockCredentialId);

      // 復号された秘密鍵（モックでは32バイトの66で埋められたもの）
      expect(secretKey).toBe(bytesToHex(new Uint8Array(32).fill(66)));
      expect(crypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('PRF直接使用方式の秘密鍵をエクスポートできる', async () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1 as const,
        alg: 'prf-direct' as const,
        credentialId: bytesToHex(mockCredentialId),
      };

      // PRF値自体がシークレットキー
      // テスト用に特別なモックを作成
      const testPrfResult = new Uint8Array(32).fill(mockPrfResultValue);
      const mockCredential = {
        getClientExtensionResults: vi.fn(() => ({
          prf: {
            results: {
              first: testPrfResult.buffer,
            },
          },
        })),
      };

      // 特別なモックを設定
      vi.spyOn(navigator.credentials, 'get').mockResolvedValueOnce(mockCredential as any);

      const secretKey = await pwkManager.exportNostrKey(mockPwkBlob, mockCredentialId);

      // PRF値自体がシークレットキー（32バイトの42で埋められたもの）
      expect(secretKey).toBe(bytesToHex(testPrfResult));
      // 復号処理は行われない
      expect(crypto.subtle.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('キャッシュ機能', () => {
    it('デフォルトではキャッシュが無効', () => {
      const pwkManager = new PWKManager();
      const options = pwkManager.getCacheOptions();
      expect(options.enabled).toBe(false);
    });

    it('コンストラクタでキャッシュ設定を指定できる', () => {
      const pwkManager = new PWKManager({
        cacheOptions: { enabled: true, timeoutMs: 10000 },
      });
      const options = pwkManager.getCacheOptions();
      expect(options.enabled).toBe(true);
      expect(options.timeoutMs).toBe(10000);
    });

    it('setCacheOptions でキャッシュ設定を更新できる', () => {
      const pwkManager = new PWKManager();
      pwkManager.setCacheOptions({ enabled: true, timeoutMs: 20000 });
      const options = pwkManager.getCacheOptions();
      expect(options.enabled).toBe(true);
      expect(options.timeoutMs).toBe(20000);
    });

    it('キャッシュが有効な場合、2回目の署名で認証が不要', async () => {
      const pwkManager = new PWKManager();
      pwkManager.setCacheOptions({ enabled: true });

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

      // 1回目の署名（PRF認証必要）
      await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId);

      // navigator.credentials.get の呼び出し回数をリセット
      vi.clearAllMocks();

      // 2回目の署名（キャッシュから取得、個別に指定必要）
      await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId, { useCache: true });

      // PRF認証が呼ばれていないことを確認
      expect(navigator.credentials.get).not.toHaveBeenCalled();
    });

    it('個別のオプションでキャッシュを制御できる', async () => {
      const pwkManager = new PWKManager();
      // グローバルにはキャッシュ無効だが、個別に有効化
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

      // キャッシュを有効にして署名
      await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId, { useCache: true });

      vi.clearAllMocks();

      // 2回目の署名（キャッシュから取得、明示的に指定が必要）
      await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId, { useCache: true });

      // PRF認証が呼ばれていないことを確認
      expect(navigator.credentials.get).not.toHaveBeenCalled();
    });

    it('clearCachedKey で特定の鍵のキャッシュをクリアできる', async () => {
      const pwkManager = new PWKManager({ cacheOptions: { enabled: true } });
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

      // キャッシュを利用して署名
      await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId);

      // 特定の鍵のキャッシュをクリア
      pwkManager.clearCachedKey(mockCredentialId);

      vi.clearAllMocks();

      // 再度署名（キャッシュがクリアされているため認証が必要）
      await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId);

      // PRF認証が呼ばれていることを確認
      expect(navigator.credentials.get).toHaveBeenCalled();
    });

    it('clearAllCachedKeys で全てのキャッシュをクリアできる', async () => {
      const pwkManager = new PWKManager({ cacheOptions: { enabled: true } });
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

      // キャッシュを利用して署名
      await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId);

      // 全てのキャッシュをクリア
      pwkManager.clearAllCachedKeys();

      vi.clearAllMocks();

      // 再度署名（キャッシュがクリアされているため認証が必要）
      await pwkManager.signEvent(mockEvent, mockPwkBlob, mockCredentialId);

      // PRF認証が呼ばれていることを確認
      expect(navigator.credentials.get).toHaveBeenCalled();
    });
  });
});
