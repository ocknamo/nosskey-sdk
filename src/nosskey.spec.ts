import { seckeySigner } from 'rx-nostr-crypto';
/**
 * Nosskey SDK テスト
 * @packageDocumentation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWKManager } from './nosskey.js';
import type { NostrEvent, PWKBlob } from './types.js';
import { bytesToHex } from './utils.js';

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

      expect(result).toHaveProperty('v');
      expect(result).toHaveProperty('alg');
      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('pubkey');
      expect(result.v).toBe(1);
      expect(result.alg).toBe('aes-gcm-256');
      expect(result.pubkey).toBe('test-pubkey');

      expect(crypto.subtle.encrypt).toHaveBeenCalled();
      expect(seckeySigner).toHaveBeenCalled();
    });
  });

  describe('generateNostrKey', () => {
    it('新しいNostr秘密鍵を生成してパスキーでラップできる', async () => {
      const pwkManager = new PWKManager();
      const credentialId = new Uint8Array(16).fill(1);

      const result = await pwkManager.generateNostrKey(credentialId);

      expect(result).toHaveProperty('v');
      expect(result).toHaveProperty('alg');
      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('pubkey');
      expect(result.v).toBe(1);
      expect(result.alg).toBe('aes-gcm-256');
      expect(result.pubkey).toBe('test-pubkey');

      expect(crypto.getRandomValues).toHaveBeenCalled();
    });
  });

  describe('directPrfToNostrKey', () => {
    it('PRF値を直接Nostrシークレットキーとして使用できる', async () => {
      const pwkManager = new PWKManager();
      const credentialId = new Uint8Array(16).fill(1);

      const result = await pwkManager.directPrfToNostrKey(credentialId);

      expect(result).toHaveProperty('v');
      expect(result).toHaveProperty('alg');
      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('pubkey');
      expect(result.v).toBe(1);
      expect(result.alg).toBe('prf-direct');
      expect(result.pubkey).toBe('test-pubkey');
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

  describe('signEventWithPWK', () => {
    it('暗号化された秘密鍵を使ってイベントに署名できる', async () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1,
        alg: 'aes-gcm-256',
        salt: bytesToHex(new Uint8Array(16).fill(11)),
        iv: bytesToHex(new Uint8Array(12).fill(22)),
        ct: bytesToHex(new Uint8Array(32).fill(33)),
        tag: bytesToHex(new Uint8Array(16).fill(44)),
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      const signedEvent = await pwkManager.signEventWithPWK(mockEvent, mockPwkBlob, {
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
        pubkey: 'test-pubkey',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr with PRF!',
        tags: [],
      };

      const signedEvent = await pwkManager.signEventWithPWK(mockEvent, mockPwkBlob);

      expect(signedEvent).toHaveProperty('id', 'test-event-id');
      expect(signedEvent).toHaveProperty('sig', 'test-signature');
      // PRF直接使用では復号処理は行われない
      expect(crypto.subtle.decrypt).not.toHaveBeenCalled();
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
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };

      const secretKey = await pwkManager.exportNostrKey(mockPwkBlob);

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
        pubkey: 'test-pubkey',
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
      vi.spyOn(navigator.credentials, 'get').mockResolvedValueOnce(
        mockCredential as unknown as Credential | null
      );

      const secretKey = await pwkManager.exportNostrKey(mockPwkBlob);

      // PRF値自体がシークレットキー（32バイトの42で埋められたもの）
      expect(secretKey).toBe(bytesToHex(testPrfResult));
      // 復号処理は行われない
      expect(crypto.subtle.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('PWK保存機能', () => {
    let mockLocalStorage: { [key: string]: string };

    beforeEach(() => {
      // localStorage のモック
      mockLocalStorage = {};
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          setItem: vi.fn((key, value) => {
            mockLocalStorage[key] = value;
          }),
          getItem: vi.fn((key) => mockLocalStorage[key] || null),
          removeItem: vi.fn((key) => {
            delete mockLocalStorage[key];
          }),
        },
        configurable: true,
      });
    });

    it('デフォルトでPWK保存が有効', () => {
      const pwkManager = new PWKManager();
      const options = pwkManager.getStorageOptions();
      expect(options.enabled).toBe(true);
      expect(options.storageKey).toBe('nosskey_pwk');
    });

    it('コンストラクタでPWK保存設定を指定できる', () => {
      const pwkManager = new PWKManager({
        storageOptions: { enabled: false, storageKey: 'custom_key' },
      });
      const options = pwkManager.getStorageOptions();
      expect(options.enabled).toBe(false);
      expect(options.storageKey).toBe('custom_key');
    });

    it('setStorageOptions でPWK保存設定を更新できる', () => {
      const pwkManager = new PWKManager();
      pwkManager.setStorageOptions({ enabled: false, storageKey: 'updated_key' });
      const options = pwkManager.getStorageOptions();
      expect(options.enabled).toBe(false);
      expect(options.storageKey).toBe('updated_key');
    });

    it('setCurrentPWK で現在のPWKを設定できる', () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1 as const,
        alg: 'prf-direct' as const,
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };

      pwkManager.setCurrentPWK(mockPwkBlob);

      // localStorage に保存されていることを確認
      expect(localStorage.setItem).toHaveBeenCalled();
      expect(mockLocalStorage['nosskey_pwk']).toBeDefined();

      // 保存された値を検証
      const storedValue = JSON.parse(mockLocalStorage['nosskey_pwk']);
      expect(storedValue.pubkey).toBe('test-pubkey');
    });

    it('getCurrentPWK で現在のPWKを取得できる', () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1 as const,
        alg: 'prf-direct' as const,
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };

      pwkManager.setCurrentPWK(mockPwkBlob);
      const currentPWK = pwkManager.getCurrentPWK();

      expect(currentPWK).not.toBeNull();
      expect(currentPWK?.pubkey).toBe('test-pubkey');
    });

    it('ストレージから現在のPWKを読み込める', () => {
      // 事前にstorageに保存
      const mockPwkBlob: PWKBlob = {
        v: 1 as const,
        alg: 'prf-direct' as const,
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };
      mockLocalStorage['nosskey_pwk'] = JSON.stringify(mockPwkBlob);

      // 新しいインスタンスを作成（コンストラクタでストレージから読み込み）
      const pwkManager = new PWKManager();
      const currentPWK = pwkManager.getCurrentPWK();

      expect(currentPWK).not.toBeNull();
      expect(currentPWK?.pubkey).toBe('test-pubkey');
      expect(localStorage.getItem).toHaveBeenCalled();
    });

    it('clearStoredPWK でストレージのPWKをクリアできる', () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1 as const,
        alg: 'prf-direct' as const,
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };

      // PWKを設定してストレージに保存
      pwkManager.setCurrentPWK(mockPwkBlob);

      // ストレージをクリア
      pwkManager.clearStoredPWK();

      // localStorage から削除されていることを確認
      expect(localStorage.removeItem).toHaveBeenCalledWith('nosskey_pwk');

      // 現在のPWKも消去されていることを確認
      expect(pwkManager.getCurrentPWK()).toBeNull();
    });
  });

  describe('NIP-07互換メソッド', () => {
    it('getPublicKey で現在のPWKから公開鍵を取得できる', async () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1 as const,
        alg: 'prf-direct' as const,
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };

      pwkManager.setCurrentPWK(mockPwkBlob);
      const pubkey = await pwkManager.getPublicKey();

      expect(pubkey).toBe('test-pubkey');
    });

    it('現在のPWKが未設定の場合、getPublicKey はエラーを投げる', async () => {
      const pwkManager = new PWKManager();

      // getCurrentPWKをモック化してnullを返すようにする
      vi.spyOn(pwkManager, 'getCurrentPWK').mockReturnValue(null);

      await expect(pwkManager.getPublicKey()).rejects.toThrow('No current PWK set');
    });

    it('signEvent で現在のPWKを使ってイベントに署名できる', async () => {
      const pwkManager = new PWKManager();
      const mockPwkBlob: PWKBlob = {
        v: 1 as const,
        alg: 'prf-direct' as const,
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, NIP-07!',
        tags: [],
      };

      // スパイを設定
      const signEventWithPWKSpy = vi.spyOn(pwkManager, 'signEventWithPWK');

      pwkManager.setCurrentPWK(mockPwkBlob);
      const signedEvent = await pwkManager.signEvent(mockEvent);

      // 既存のsignEventWithPWKメソッドが呼ばれたことを確認
      expect(signEventWithPWKSpy).toHaveBeenCalledWith(mockEvent, mockPwkBlob);

      // 署名されたイベントを検証
      expect(signedEvent).toHaveProperty('id', 'test-event-id');
      expect(signedEvent).toHaveProperty('sig', 'test-signature');
    });

    it('現在のPWKが未設定の場合、signEvent はエラーを投げる', async () => {
      const pwkManager = new PWKManager();
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      // getCurrentPWKをモック化してnullを返すようにする
      vi.spyOn(pwkManager, 'getCurrentPWK').mockReturnValue(null);

      await expect(pwkManager.signEvent(mockEvent)).rejects.toThrow('No current PWK set');
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
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      // 1回目の署名（PRF認証必要）
      await pwkManager.signEventWithPWK(mockEvent, mockPwkBlob);

      // navigator.credentials.get の呼び出し回数をリセット
      vi.clearAllMocks();

      // 2回目の署名（キャッシュから取得）
      await pwkManager.signEventWithPWK(mockEvent, mockPwkBlob);

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
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      // キャッシュを利用して署名
      await pwkManager.signEventWithPWK(mockEvent, mockPwkBlob);

      // 特定の鍵のキャッシュをクリア
      pwkManager.clearCachedKey(mockCredentialId);

      vi.clearAllMocks();

      // 再度署名（キャッシュがクリアされているため認証が必要）
      await pwkManager.signEventWithPWK(mockEvent, mockPwkBlob);

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
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      // キャッシュを利用して署名
      await pwkManager.signEventWithPWK(mockEvent, mockPwkBlob);

      // 全てのキャッシュをクリア
      pwkManager.clearAllCachedKeys();

      vi.clearAllMocks();

      // 再度署名（キャッシュがクリアされているため認証が必要）
      await pwkManager.signEventWithPWK(mockEvent, mockPwkBlob);

      // PRF認証が呼ばれていることを確認
      expect(navigator.credentials.get).toHaveBeenCalled();
    });
  });
});
