import { seckeySigner } from '@rx-nostr/crypto';
/**
 * Nosskey SDK テスト
 * @packageDocumentation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager } from './nosskey.js';
import type { NostrEvent, NostrKeyInfo } from './types.js';
import { bytesToHex } from './utils.js';

// @rx-nostr/crypto のモック
vi.mock('@rx-nostr/crypto', () => {
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

describe('NosskeyManager', () => {
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
      const nosskey = new NosskeyManager();
      const result = await nosskey.isPrfSupported();
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

      const nosskey = new NosskeyManager();
      const result = await nosskey.isPrfSupported();
      expect(result).toBe(false);
    });
  });

  describe('createPasskey', () => {
    it('パスキーを作成してCredentialIDを返す', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = await nosskey.createPasskey();

      expect(credentialId).toBeInstanceOf(Uint8Array);
      expect(credentialId.length).toBeGreaterThan(0);
      expect(navigator.credentials.create).toHaveBeenCalled();
    });
  });

  describe('createNostrKey', () => {
    it('PRF値を直接Nostrシークレットキーとして使用できる', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = new Uint8Array(16).fill(1);

      const result = await nosskey.createNostrKey(credentialId);

      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('pubkey');
      expect(result).toHaveProperty('salt');
      expect(result.pubkey).toBe('test-pubkey');
      expect(result.salt).toBe('6e6f7374722d6b6579'); // "nostr-key"のhex
    });

    it('prfOptionsを指定してPRF取得をカスタマイズできる', async () => {
      const nosskey = new NosskeyManager({
        prfOptions: {
          rpId: 'example.com',
          timeout: 60000,
          userVerification: 'preferred',
        },
      });
      const credentialId = new Uint8Array(16).fill(1);

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');

      await nosskey.createNostrKey(credentialId);

      expect(getPrfSecretSpy).toHaveBeenCalledWith(credentialId, {
        rpId: 'example.com',
        timeout: 60000,
        userVerification: 'preferred',
      });
    });

    it('PRF値がゼロの場合はエラーを投げる', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = new Uint8Array(16).fill(1);

      // PRFの結果がすべて0の場合をモック
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => ({
            rawId: credentialId.buffer,
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

      await expect(nosskey.createNostrKey(credentialId)).rejects.toThrow('Invalid PRF output');
    });
  });

  describe('signEventWithKeyInfo', () => {
    it('NostrKeyInfoを使ってイベントに署名できる', async () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      const signedEvent = await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo, {
        tags: [['t', 'test']],
      });

      expect(signedEvent).toHaveProperty('id', 'test-event-id');
      expect(signedEvent).toHaveProperty('sig', 'test-signature');
    });

    it('prfOptionsを指定してPRF取得をカスタマイズできる', async () => {
      const nosskey = new NosskeyManager({
        prfOptions: {
          rpId: 'example.com',
          timeout: 60000,
          userVerification: 'preferred',
        },
      });
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');

      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      expect(getPrfSecretSpy).toHaveBeenCalledWith(expect.any(Uint8Array), {
        rpId: 'example.com',
        timeout: 60000,
        userVerification: 'preferred',
      });
    });
  });

  describe('exportNostrKey', () => {
    it('PRF直接使用方式の秘密鍵をエクスポートできる', async () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      // PRF値自体がシークレットキー
      const testPrfResult = new Uint8Array(32).fill(mockPrfResultValue);
      const mockCredential = {
        rawId: mockCredentialId.buffer,
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

      const secretKey = await nosskey.exportNostrKey(mockKeyInfo);

      // PRF値自体がシークレットキー（32バイトの42で埋められたもの）
      expect(secretKey).toBe(bytesToHex(testPrfResult));
    });

    it('prfOptionsを指定してPRF取得をカスタマイズできる', async () => {
      const nosskey = new NosskeyManager({
        prfOptions: {
          rpId: 'example.com',
          timeout: 60000,
          userVerification: 'preferred',
        },
      });
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');

      await nosskey.exportNostrKey(mockKeyInfo);

      expect(getPrfSecretSpy).toHaveBeenCalledWith(expect.any(Uint8Array), {
        rpId: 'example.com',
        timeout: 60000,
        userVerification: 'preferred',
      });
    });
  });

  describe('NostrKeyInfo保存機能', () => {
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

    it('デフォルトでNostrKeyInfo保存が有効', () => {
      const nosskey = new NosskeyManager();
      const options = nosskey.getStorageOptions();
      expect(options.enabled).toBe(true);
      expect(options.storageKey).toBe('nosskey_keyinfo');
    });

    it('コンストラクタでNostrKeyInfo保存設定を指定できる', () => {
      const nosskey = new NosskeyManager({
        storageOptions: { enabled: false, storageKey: 'custom_key' },
      });
      const options = nosskey.getStorageOptions();
      expect(options.enabled).toBe(false);
      expect(options.storageKey).toBe('custom_key');
    });

    it('setStorageOptions でNostrKeyInfo保存設定を更新できる', () => {
      const nosskey = new NosskeyManager();
      nosskey.setStorageOptions({ enabled: false, storageKey: 'updated_key' });
      const options = nosskey.getStorageOptions();
      expect(options.enabled).toBe(false);
      expect(options.storageKey).toBe('updated_key');
    });

    it('setCurrentKeyInfo で現在のNostrKeyInfoを設定できる', () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      nosskey.setCurrentKeyInfo(mockKeyInfo);

      // localStorage に保存されていることを確認
      expect(localStorage.setItem).toHaveBeenCalled();
      expect(mockLocalStorage['nosskey_keyinfo']).toBeDefined();

      // 保存された値を検証
      const storedValue = JSON.parse(mockLocalStorage['nosskey_keyinfo']);
      expect(storedValue.pubkey).toBe('test-pubkey');
    });

    it('getCurrentKeyInfo で現在のNostrKeyInfoを取得できる', () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      nosskey.setCurrentKeyInfo(mockKeyInfo);
      const currentKeyInfo = nosskey.getCurrentKeyInfo();

      expect(currentKeyInfo).not.toBeNull();
      expect(currentKeyInfo?.pubkey).toBe('test-pubkey');
    });

    it('ストレージから現在のNostrKeyInfoを読み込める', () => {
      // 事前にstorageに保存
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      mockLocalStorage['nosskey_keyinfo'] = JSON.stringify(mockKeyInfo);

      // 新しいインスタンスを作成（コンストラクタでストレージから読み込み）
      const nosskey = new NosskeyManager();
      const currentKeyInfo = nosskey.getCurrentKeyInfo();

      expect(currentKeyInfo).not.toBeNull();
      expect(currentKeyInfo?.pubkey).toBe('test-pubkey');
      expect(localStorage.getItem).toHaveBeenCalled();
    });

    it('clearStoredKeyInfo でストレージのNostrKeyInfoをクリアできる', () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      // NostrKeyInfoを設定してストレージに保存
      nosskey.setCurrentKeyInfo(mockKeyInfo);

      // ストレージをクリア
      nosskey.clearStoredKeyInfo();

      // localStorage から削除されていることを確認
      expect(localStorage.removeItem).toHaveBeenCalledWith('nosskey_keyinfo');

      // 現在のNostrKeyInfoも消去されていることを確認
      expect(nosskey.getCurrentKeyInfo()).toBeNull();
    });
  });

  describe('NIP-07互換メソッド', () => {
    it('getPublicKey で現在のNostrKeyInfoから公開鍵を取得できる', async () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      nosskey.setCurrentKeyInfo(mockKeyInfo);
      const pubkey = await nosskey.getPublicKey();

      expect(pubkey).toBe('test-pubkey');
    });

    it('現在のNostrKeyInfoが未設定の場合、getPublicKey はエラーを投げる', async () => {
      const nosskey = new NosskeyManager();

      // getCurrentKeyInfoをモック化してnullを返すようにする
      vi.spyOn(nosskey, 'getCurrentKeyInfo').mockReturnValue(null);

      await expect(nosskey.getPublicKey()).rejects.toThrow('No current NostrKeyInfo set');
    });

    it('signEvent で現在のNostrKeyInfoを使ってイベントに署名できる', async () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, NIP-07!',
        tags: [],
      };

      // スパイを設定
      const signEventWithKeyInfoSpy = vi.spyOn(nosskey, 'signEventWithKeyInfo');

      nosskey.setCurrentKeyInfo(mockKeyInfo);
      const signedEvent = await nosskey.signEvent(mockEvent);

      // 既存のsignEventWithKeyInfoメソッドが呼ばれたことを確認
      expect(signEventWithKeyInfoSpy).toHaveBeenCalledWith(mockEvent, mockKeyInfo);

      // 署名されたイベントを検証
      expect(signedEvent).toHaveProperty('id', 'test-event-id');
      expect(signedEvent).toHaveProperty('sig', 'test-signature');
    });

    it('現在のNostrKeyInfoが未設定の場合、signEvent はエラーを投げる', async () => {
      const nosskey = new NosskeyManager();
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      // getCurrentKeyInfoをモック化してnullを返すようにする
      vi.spyOn(nosskey, 'getCurrentKeyInfo').mockReturnValue(null);

      await expect(nosskey.signEvent(mockEvent)).rejects.toThrow('No current NostrKeyInfo set');
    });
  });

  describe('キャッシュ機能', () => {
    it('デフォルトではキャッシュが無効', () => {
      const nosskey = new NosskeyManager();
      const options = nosskey.getCacheOptions();
      expect(options.enabled).toBe(false);
    });

    it('コンストラクタでキャッシュ設定を指定できる', () => {
      const nosskey = new NosskeyManager({
        cacheOptions: { enabled: true, timeoutMs: 10000 },
      });
      const options = nosskey.getCacheOptions();
      expect(options.enabled).toBe(true);
      expect(options.timeoutMs).toBe(10000);
    });

    it('setCacheOptions でキャッシュ設定を更新できる', () => {
      const nosskey = new NosskeyManager();
      nosskey.setCacheOptions({ enabled: true, timeoutMs: 20000 });
      const options = nosskey.getCacheOptions();
      expect(options.enabled).toBe(true);
      expect(options.timeoutMs).toBe(20000);
    });

    it('キャッシュが有効な場合、2回目の署名で認証が不要', async () => {
      const nosskey = new NosskeyManager();
      nosskey.setCacheOptions({ enabled: true });

      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      // 1回目の署名（PRF認証必要）
      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      // navigator.credentials.get の呼び出し回数をリセット
      vi.clearAllMocks();

      // 2回目の署名（キャッシュから取得）
      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      // PRF認証が呼ばれていないことを確認
      expect(navigator.credentials.get).not.toHaveBeenCalled();
    });

    it('clearCachedKey で特定の鍵のキャッシュをクリアできる', async () => {
      const nosskey = new NosskeyManager({ cacheOptions: { enabled: true } });
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      // キャッシュを利用して署名
      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      // 特定の鍵のキャッシュをクリア
      nosskey.clearCachedKey(mockCredentialId);

      vi.clearAllMocks();

      // 再度署名（キャッシュがクリアされているため認証が必要）
      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      // PRF認証が呼ばれていることを確認
      expect(navigator.credentials.get).toHaveBeenCalled();
    });

    it('clearAllCachedKeys で全てのキャッシュをクリアできる', async () => {
      const nosskey = new NosskeyManager({ cacheOptions: { enabled: true } });
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      // キャッシュを利用して署名
      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      // 全てのキャッシュをクリア
      nosskey.clearAllCachedKeys();

      vi.clearAllMocks();

      // 再度署名（キャッシュがクリアされているため認証が必要）
      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      // PRF認証が呼ばれていることを確認
      expect(navigator.credentials.get).toHaveBeenCalled();
    });
  });

  describe('hasKeyInfo', () => {
    let mockLocalStorage: { [key: string]: string };

    beforeEach(() => {
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

    it('メモリにNostrKeyInfoが設定されている場合はtrueを返す', () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      nosskey.setCurrentKeyInfo({
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      });
      expect(nosskey.hasKeyInfo()).toBe(true);
    });

    it('メモリ空 かつ ストレージ無効 の場合はfalseを返す', () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      expect(nosskey.hasKeyInfo()).toBe(false);
    });

    it('メモリ空 かつ ストレージ有効 かつ ストレージにデータがある場合はtrueを返しメモリにロードする', () => {
      // コンストラクタのロードを回避するためストレージ無効で作成
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });

      // ストレージ有効化（コンストラクタロードは既に終わっている）
      nosskey.setStorageOptions({ enabled: true });

      // 有効化後にストレージにデータを入れる
      mockLocalStorage['nosskey_keyinfo'] = JSON.stringify({
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'stored-pubkey',
        salt: '6e6f7374722d6b6579',
      });

      // hasKeyInfo がストレージから読み込むパスを通る
      expect(nosskey.hasKeyInfo()).toBe(true);
      // 副作用でメモリにロードされていることを確認
      expect(nosskey.getCurrentKeyInfo()?.pubkey).toBe('stored-pubkey');
    });

    it('メモリ空 かつ ストレージ有効 でデータがない場合はfalseを返す', () => {
      const nosskey = new NosskeyManager();
      expect(nosskey.hasKeyInfo()).toBe(false);
    });
  });

  describe('カスタム Storage オプション', () => {
    const createMockStorage = (): Storage => ({
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      key: vi.fn(() => null),
    });

    it('コンストラクタで指定したカスタムstorageが使用される', () => {
      const customStorage = createMockStorage();
      const nosskey = new NosskeyManager({
        storageOptions: { enabled: true, storage: customStorage },
      });

      const keyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      nosskey.setCurrentKeyInfo(keyInfo);

      expect(customStorage.setItem).toHaveBeenCalledWith(
        'nosskey_keyinfo',
        JSON.stringify(keyInfo)
      );
    });

    it('setStorageOptionsで後から指定したカスタムstorageが使用される', () => {
      const customStorage = createMockStorage();
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      nosskey.setStorageOptions({ enabled: true, storage: customStorage });

      const keyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      nosskey.setCurrentKeyInfo(keyInfo);

      expect(customStorage.setItem).toHaveBeenCalled();
    });

    it('カスタムstorageからのロードが動作する', () => {
      const storedKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'from-custom-storage',
        salt: '6e6f7374722d6b6579',
      };
      const customStorage = createMockStorage();
      (customStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'nosskey_keyinfo' ? JSON.stringify(storedKeyInfo) : null
      );

      const nosskey = new NosskeyManager({
        storageOptions: { enabled: true, storage: customStorage },
      });

      expect(customStorage.getItem).toHaveBeenCalledWith('nosskey_keyinfo');
      expect(nosskey.getCurrentKeyInfo()?.pubkey).toBe('from-custom-storage');
    });
  });

  describe('createNostrKey with username オプション', () => {
    // NOTE: 既存の `signEventWithKeyInfo` テストで共有 `mockPrfResult` ArrayBuffer が
    // fill(0) 汚染されるため、getPrfSecret を直接 spyOn で差し替えて独立した Uint8Array を返す
    it('usernameを指定するとNostrKeyInfoにusernameが含まれる', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      const result = await nosskey.createNostrKey(mockCredentialId, { username: 'alice' });

      expect(result.username).toBe('alice');
    });

    it('usernameを省略するとNostrKeyInfoにusernameプロパティが含まれない', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      const result = await nosskey.createNostrKey(mockCredentialId);

      expect('username' in result).toBe(false);
    });
  });

  describe('signEventWithKeyInfo - clearMemoryとキャッシュの相互作用', () => {
    const mockKeyInfo: NostrKeyInfo = {
      credentialId: bytesToHex(mockCredentialId),
      pubkey: 'test-pubkey',
      salt: '6e6f7374722d6b6579',
    };
    const mockEvent: NostrEvent = { kind: 1, content: 'test', tags: [] };

    it('キャッシュ無効 + clearMemory=true (デフォルト) で署名後に秘密鍵がメモリクリアされる', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const prfSecret = new Uint8Array(32).fill(42);

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({ secret: prfSecret, id: mockCredentialId });

      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      // 全バイトが0埋めされていることを確認
      expect(Array.from(prfSecret)).toEqual(new Array(32).fill(0));
    });

    it('キャッシュ無効 + clearMemory=false で署名後も秘密鍵はクリアされない', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const prfSecret = new Uint8Array(32).fill(42);

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({ secret: prfSecret, id: mockCredentialId });

      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo, { clearMemory: false });

      expect(Array.from(prfSecret)).toEqual(new Array(32).fill(42));
    });

    it('キャッシュ有効 + clearMemory=true でも元の秘密鍵バッファはクリアされない（キャッシュ優先）', async () => {
      const nosskey = new NosskeyManager({
        cacheOptions: { enabled: true },
        storageOptions: { enabled: false },
      });
      const prfSecret = new Uint8Array(32).fill(42);

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({ secret: prfSecret, id: mockCredentialId });

      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo, { clearMemory: true });

      // キャッシュが有効なので #clearKey は呼ばれず、元バッファは保持される
      expect(Array.from(prfSecret)).toEqual(new Array(32).fill(42));
    });
  });

  describe('exportNostrKey - credentialId省略時挙動', () => {
    it('credentialId省略時、keyInfo.credentialIdをhexToBytesして getPrfSecret に渡す', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');

      await nosskey.exportNostrKey(mockKeyInfo);

      // 引数で hexToBytes された Uint8Array が渡されているか確認
      const [calledCredentialId] = getPrfSecretSpy.mock.calls[0];
      expect(calledCredentialId).toBeInstanceOf(Uint8Array);
      expect(Array.from(calledCredentialId as Uint8Array)).toEqual(Array.from(mockCredentialId));
    });
  });

  describe('setStorageOptions で enabled:false にするとストレージがクリアされる', () => {
    let mockLocalStorage: { [key: string]: string };

    beforeEach(() => {
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

    it('setStorageOptions({enabled:false}) で clearStoredKeyInfo が呼ばれる', () => {
      const nosskey = new NosskeyManager();
      const keyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      nosskey.setCurrentKeyInfo(keyInfo);
      expect(mockLocalStorage['nosskey_keyinfo']).toBeDefined();

      nosskey.setStorageOptions({ enabled: false });

      expect(mockLocalStorage['nosskey_keyinfo']).toBeUndefined();
      expect(nosskey.getCurrentKeyInfo()).toBeNull();
    });
  });

  describe('#loadKeyInfoFromStorageのエラーハンドリング', () => {
    let mockLocalStorage: { [key: string]: string };

    beforeEach(() => {
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

    it('壊れたJSONが保存されている場合、nullを返しconsole.errorを呼ぶ', () => {
      mockLocalStorage['nosskey_keyinfo'] = '{not-json';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const nosskey = new NosskeyManager();

      expect(nosskey.getCurrentKeyInfo()).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to parse stored NostrKeyInfo',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('localStorage非搭載環境での挙動', () => {
    let originalLocalStorage: typeof globalThis.localStorage | undefined;

    beforeEach(() => {
      originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;
      Object.defineProperty(globalThis, 'localStorage', {
        value: undefined,
        configurable: true,
      });
    });

    afterEach(() => {
      if (originalLocalStorage !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', {
          value: originalLocalStorage,
          configurable: true,
        });
      }
    });

    it('localStorage未定義でもsetCurrentKeyInfoが例外を投げない', () => {
      const nosskey = new NosskeyManager();
      const keyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      expect(() => nosskey.setCurrentKeyInfo(keyInfo)).not.toThrow();
      // メモリには保持される
      expect(nosskey.getCurrentKeyInfo()).toEqual(keyInfo);
    });

    it('localStorage未定義でもclearStoredKeyInfoが例外を投げない', () => {
      const nosskey = new NosskeyManager();
      expect(() => nosskey.clearStoredKeyInfo()).not.toThrow();
    });
  });
});
