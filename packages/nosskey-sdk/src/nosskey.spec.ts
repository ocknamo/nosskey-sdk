import { seckeySigner } from '@rx-nostr/crypto';
/**
 * Nosskey SDK テスト
 * @packageDocumentation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager } from './nosskey.js';
import type { NostrEvent, NostrKeyInfo } from './types.js';
import { bytesToHex, hexToBytes } from './utils.js';

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
  const mockCredentialId = new Uint8Array(16).fill(1);
  let originalCrypto: typeof globalThis.crypto;
  let originalCredentials: typeof globalThis.navigator.credentials;

  // モックセットアップ
  beforeEach(() => {
    originalCrypto = globalThis.crypto;
    originalCredentials = globalThis.navigator.credentials;

    // PRF出力を含むモックの応答。getClientExtensionResults() は呼び出しごとに
    // 新しい ArrayBuffer を返す。NosskeyManager は秘密鍵をエフェメラルに使い
    // 終わったあと .fill(0) で消去するので、共有バッファを使うとそれが次の
    // 呼び出しに伝播する（ゼロ鍵 → ECDH エラー）。実機ブラウザでは PRF も
    // 毎回フレッシュなので、フレッシュ生成の方が現実に近い挙動でもある。
    const mockCredential = {
      id: 'mock-credential-id',
      rawId: mockCredentialId.buffer,
      type: 'public-key',
      getClientExtensionResults: vi.fn(() => ({
        prf: {
          results: {
            first: new Uint8Array(32).fill(mockPrfResultValue).buffer,
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
      expect(result.salt).toBe('6e6f7374722d70776b'); // "nostr-pwk"のhex
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

      expect(getPrfSecretSpy).toHaveBeenCalledWith(
        credentialId,
        {
          rpId: 'example.com',
          timeout: 60000,
          userVerification: 'preferred',
          residentKey: 'required',
          requireResidentKey: true,
        },
        hexToBytes('6e6f7374722d70776b')
      );
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
      };
      const mockEvent: NostrEvent = {
        kind: 1,
        content: 'Hello, Nostr!',
        tags: [],
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');

      await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);

      expect(getPrfSecretSpy).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        {
          rpId: 'example.com',
          timeout: 60000,
          userVerification: 'preferred',
          residentKey: 'required',
          requireResidentKey: true,
        },
        hexToBytes('6e6f7374722d70776b')
      );
    });
  });

  describe('exportNostrKey', () => {
    it('PRF直接使用方式の秘密鍵をエクスポートできる', async () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
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

      // 期待値を「PRFバッファがゼロ化される前」に確定させる。
      // exportNostrKey は #getSecretKey 経由になり、release() が PRF バッファを
      // .fill(0) する。getPrfSecret 内部の new Uint8Array(arrayBuffer) は元の
      // ArrayBuffer をビューで共有するため、testPrfResult も同期的にゼロ化される。
      const expectedHex = bytesToHex(testPrfResult);
      const secretKey = await nosskey.exportNostrKey(mockKeyInfo);

      // PRF値自体がシークレットキー（32バイトの42で埋められたもの）
      expect(secretKey).toBe(expectedHex);
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
        salt: '6e6f7374722d70776b',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');

      await nosskey.exportNostrKey(mockKeyInfo);

      expect(getPrfSecretSpy).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        {
          rpId: 'example.com',
          timeout: 60000,
          userVerification: 'preferred',
          residentKey: 'required',
          requireResidentKey: true,
        },
        hexToBytes('6e6f7374722d70776b')
      );
    });
  });

  describe('salt の導出への利用と正規化', () => {
    it('signEventWithKeyInfo は keyInfo.salt をPRF評価入力として getPrfSecret に渡す', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const keyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      await nosskey.signEventWithKeyInfo({ kind: 1, content: 'test', tags: [] }, keyInfo);

      expect(getPrfSecretSpy.mock.calls[0][2]).toEqual(hexToBytes('6e6f7374722d70776b'));
    });

    it('旧salt値 (6e6f7374722d6b6579) は標準値へ正規化して導出に使われる', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const legacyKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      await nosskey.signEventWithKeyInfo({ kind: 1, content: 'test', tags: [] }, legacyKeyInfo);

      expect(getPrfSecretSpy.mock.calls[0][2]).toEqual(hexToBytes('6e6f7374722d70776b'));
    });

    it('salt 未設定の keyInfo も標準値へ正規化して導出に使われる', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const keyInfoWithoutSalt = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      } as NostrKeyInfo;

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      await nosskey.signEventWithKeyInfo(
        { kind: 1, content: 'test', tags: [] },
        keyInfoWithoutSalt
      );

      expect(getPrfSecretSpy.mock.calls[0][2]).toEqual(hexToBytes('6e6f7374722d70776b'));
    });

    it('exportNostrKey は旧salt値を標準値へ正規化して getPrfSecret に渡す', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const legacyKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      await nosskey.exportNostrKey(legacyKeyInfo);

      expect(getPrfSecretSpy.mock.calls[0][2]).toEqual(hexToBytes('6e6f7374722d70776b'));
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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

    it('ストレージの旧salt値は読込時に標準値へ正規化され修復保存される', () => {
      const legacyKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };
      mockLocalStorage['nosskey_keyinfo'] = JSON.stringify(legacyKeyInfo);

      const nosskey = new NosskeyManager();

      // 読み込んだ keyInfo は標準salt値へ正規化されている
      expect(nosskey.getCurrentKeyInfo()?.salt).toBe('6e6f7374722d70776b');

      // ストレージ自体も標準値へ修復保存されている
      expect(JSON.parse(mockLocalStorage['nosskey_keyinfo']).salt).toBe('6e6f7374722d70776b');
    });
  });

  describe('NIP-07互換メソッド', () => {
    it('getPublicKey で現在のNostrKeyInfoから公開鍵を取得できる', async () => {
      const nosskey = new NosskeyManager();
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
      };
      nosskey.setCurrentKeyInfo(keyInfo);

      expect(customStorage.setItem).toHaveBeenCalled();
    });

    it('storage を差し替えると in-memory cache が invalidate される', () => {
      const keyInfoA: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'pubkey-from-storage-a',
        salt: '6e6f7374722d70776b',
      };
      const keyInfoB: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'pubkey-from-storage-b',
        salt: '6e6f7374722d70776b',
      };
      const storageA = createMockStorage();
      (storageA.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'nosskey_keyinfo' ? JSON.stringify(keyInfoA) : null
      );
      const storageB = createMockStorage();
      (storageB.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'nosskey_keyinfo' ? JSON.stringify(keyInfoB) : null
      );

      const nosskey = new NosskeyManager({
        storageOptions: { enabled: true, storage: storageA },
      });
      expect(nosskey.getCurrentKeyInfo()?.pubkey).toBe('pubkey-from-storage-a');

      nosskey.setStorageOptions({ storage: storageB });

      expect(nosskey.getCurrentKeyInfo()?.pubkey).toBe('pubkey-from-storage-b');
    });

    it('同じ storage 参照を渡し直した場合は cache を保持する', () => {
      const keyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'cached-pubkey',
        salt: '6e6f7374722d70776b',
      };
      const customStorage = createMockStorage();
      (customStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'nosskey_keyinfo' ? JSON.stringify(keyInfo) : null
      );

      const nosskey = new NosskeyManager({
        storageOptions: { enabled: true, storage: customStorage },
      });
      const getItemMock = customStorage.getItem as ReturnType<typeof vi.fn>;
      const callsAfterCtor = getItemMock.mock.calls.length;

      nosskey.setStorageOptions({ storage: customStorage });
      const result = nosskey.getCurrentKeyInfo();

      expect(result?.pubkey).toBe('cached-pubkey');
      // 同参照なので invalidate されず、追加の storage.getItem は発生しない
      expect(getItemMock.mock.calls.length).toBe(callsAfterCtor);
    });

    it('storageKey のみ変更しても cache は保持される', () => {
      const keyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'cached-pubkey',
        salt: '6e6f7374722d70776b',
      };
      const customStorage = createMockStorage();
      (customStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'nosskey_keyinfo' ? JSON.stringify(keyInfo) : null
      );

      const nosskey = new NosskeyManager({
        storageOptions: { enabled: true, storage: customStorage },
      });
      const getItemMock = customStorage.getItem as ReturnType<typeof vi.fn>;
      const callsAfterCtor = getItemMock.mock.calls.length;

      nosskey.setStorageOptions({ storageKey: 'other-key' });
      const result = nosskey.getCurrentKeyInfo();

      expect(result?.pubkey).toBe('cached-pubkey');
      expect(getItemMock.mock.calls.length).toBe(callsAfterCtor);
    });

    it('カスタムstorageからのロードが動作する', () => {
      const storedKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'from-custom-storage',
        salt: '6e6f7374722d70776b',
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

    it('storage.setItem が例外を投げても unhandled rejection を起こさずエラーをログする', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const rejections: unknown[] = [];
      const onRejection = (reason: unknown) => rejections.push(reason);
      process.on('unhandledRejection', onRejection);
      try {
        const customStorage = createMockStorage();
        (customStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
          throw new Error('QuotaExceededError');
        });
        const nosskey = new NosskeyManager({
          storageOptions: { enabled: true, storage: customStorage },
        });
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(mockCredentialId),
          pubkey: 'persist-failure',
          salt: '6e6f7374722d70776b',
        };

        expect(() => nosskey.setCurrentKeyInfo(keyInfo)).not.toThrow();
        // 書き込みに失敗しても in-memory の NostrKeyInfo は保持される
        expect(nosskey.getCurrentKeyInfo()?.pubkey).toBe('persist-failure');
        expect(errorSpy).toHaveBeenCalled();
        // #saveKeyInfoToStorage は async。catch を外すと void 呼び出しで
        // unhandled rejection になるため、マイクロタスク消化後も発生しないことを確認。
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(rejections).toEqual([]);
      } finally {
        process.off('unhandledRejection', onRejection);
        errorSpy.mockRestore();
      }
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
      salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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
        salt: '6e6f7374722d70776b',
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

  describe('NIP-44 / NIP-04 暗号化メソッド', () => {
    // The PRF mock returns 32 bytes of 0x2a, which is a valid secp256k1 scalar.
    // We pair it with a peer pubkey derived from a known private key.
    const peerSecret = new Uint8Array(32).fill(0x33);
    let peerPubHex: string;

    beforeEach(async () => {
      const { schnorr } = await import('@noble/curves/secp256k1.js');
      peerPubHex = bytesToHex(schnorr.getPublicKey(peerSecret));
    });

    it('nip44Encrypt / nip44Decrypt のラウンドトリップ', async () => {
      const nosskey = new NosskeyManager();
      nosskey.setCurrentKeyInfo({
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
      });

      const ciphertext = await nosskey.nip44Encrypt(peerPubHex, 'こんにちは 🌸');
      // Decrypt from the peer's perspective to validate the payload is well-formed.
      const { schnorr } = await import('@noble/curves/secp256k1.js');
      const ourSk = new Uint8Array(32).fill(mockPrfResultValue);
      const ourPubHex = bytesToHex(schnorr.getPublicKey(ourSk));
      const { nip44Decrypt } = await import('./nip44.js');
      expect(nip44Decrypt(ciphertext, peerSecret, ourPubHex)).toBe('こんにちは 🌸');

      // And decrypting back through NosskeyManager works.
      expect(await nosskey.nip44Decrypt(peerPubHex, ciphertext)).toBe('こんにちは 🌸');
    });

    it('nip04Encrypt / nip04Decrypt のラウンドトリップ', async () => {
      const nosskey = new NosskeyManager();
      nosskey.setCurrentKeyInfo({
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
      });

      const ciphertext = await nosskey.nip04Encrypt(peerPubHex, 'hello legacy DM');
      expect(ciphertext).toMatch(/\?iv=/);
      expect(await nosskey.nip04Decrypt(peerPubHex, ciphertext)).toBe('hello legacy DM');
    });

    it('NostrKeyInfo 未設定だと nip44Encrypt はエラー', async () => {
      const nosskey = new NosskeyManager();
      vi.spyOn(nosskey, 'getCurrentKeyInfo').mockReturnValue(null);
      await expect(nosskey.nip44Encrypt(peerPubHex, 'x')).rejects.toThrow(
        'No current NostrKeyInfo set'
      );
    });

    it('NostrKeyInfo 未設定だと nip04Decrypt はエラー', async () => {
      const nosskey = new NosskeyManager();
      vi.spyOn(nosskey, 'getCurrentKeyInfo').mockReturnValue(null);
      await expect(nosskey.nip04Decrypt(peerPubHex, 'foo?iv=bar')).rejects.toThrow(
        'No current NostrKeyInfo set'
      );
    });
  });

  /**
   * wrap モードの実値テスト群。
   *
   * 既存テストは `@rx-nostr/crypto` 全モックで `seckeySigner.getPublicKey()` を固定値
   * `'test-pubkey'` に潰しているため、`nip44Encrypt` の peerPk が 32B hex でなく ECDH が
   * 失敗する。この describe 内では `seckeySigner` を「sk hex から本物の secp256k1 x-only
   * pubkey を計算する実装」に差し替え、`nip44Encrypt`/`nip44Decrypt` は本物を走らせる
   * （`./nip44.js` はそもそも全モックの対象外）。
   *
   * テストベクトル戦略: nip44Encrypt の `nonceOverride` で固定 nonce 生成した payload を
   * 「事前生成済みの wrapped payload」として復号テストに使い、復号結果が元の seckey と
   * バイト一致することで実値ラウンドトリップを担保する。
   */
  describe('wrap モード（実値テスト）', () => {
    const TV_SECKEY_HEX = '0101010101010101010101010101010101010101010101010101010101010101';
    const TV_KEK_HEX = '4242424242424242424242424242424242424242424242424242424242424242';
    const TV_NONCE_HEX = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    const WRAP_SALT_HEX = '6e6f7374722d70776b2d77726170';

    let TV_IMPORTED_PUBKEY: string;
    let TV_KEK_PUBKEY: string;
    // 固定 nonce で決定論的に生成された wrapped.payload（テストベクトル）
    let TV_PAYLOAD_B64: string;

    beforeEach(async () => {
      const { schnorr } = await import('@noble/curves/secp256k1.js');
      const { nip44Encrypt: realNip44Encrypt } = await import('./nip44.js');

      TV_IMPORTED_PUBKEY = bytesToHex(schnorr.getPublicKey(hexToBytes(TV_SECKEY_HEX)));
      TV_KEK_PUBKEY = bytesToHex(schnorr.getPublicKey(hexToBytes(TV_KEK_HEX)));
      TV_PAYLOAD_B64 = realNip44Encrypt(
        TV_SECKEY_HEX,
        hexToBytes(TV_KEK_HEX),
        TV_KEK_PUBKEY,
        hexToBytes(TV_NONCE_HEX)
      );

      // seckeySigner モックを「sk hex から本物の secp256k1 x-only pubkey を返す」実装に差し替え。
      // signEvent はテスト判定用の固定値を返す（実 schnorr 署名検証はここではスコープ外）。
      vi.mocked(seckeySigner).mockImplementation(
        (skHex: string) =>
          ({
            getPublicKey: async () => bytesToHex(schnorr.getPublicKey(hexToBytes(skHex))),
            signEvent: vi.fn(async (event: NostrEvent) => ({
              ...event,
              id: 'wrap-mock-id',
              sig: 'wrap-mock-sig',
            })),
          }) as unknown as ReturnType<typeof seckeySigner>
      );
    });

    describe('importNostrKey', () => {
      it('正常系: 実物 nip44Encrypt で wrapped payload を生成し、復号で元の seckey に戻る', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
        });

        const seckey = hexToBytes(TV_SECKEY_HEX); // 新規バッファ（呼び出し後ゼロ化される想定）
        const result = await nosskey.importNostrKey(seckey);

        // 基本フィールドの assertion
        expect(result.pubkey).toBe(TV_IMPORTED_PUBKEY);
        expect(result.salt).toBe(WRAP_SALT_HEX);
        expect(result.wrapped).toBeDefined();
        expect(result.wrapped?.v).toBe(1);
        expect(result.wrapped?.alg).toBe('nip44-v2');
        expect(typeof result.wrapped?.payload).toBe('string');
        expect(result.wrapped?.payload.length).toBeGreaterThan(0);

        // 実物 nip44Decrypt で元の seckey hex に戻ることを確認（実値ラウンドトリップ）
        const { nip44Decrypt: realNip44Decrypt } = await import('./nip44.js');
        const decrypted = realNip44Decrypt(
          result.wrapped?.payload as string,
          hexToBytes(TV_KEK_HEX),
          TV_KEK_PUBKEY
        );
        expect(decrypted).toBe(TV_SECKEY_HEX);

        // 呼び出し後 seckey 入力バッファがゼロ化されている
        expect(Array.from(seckey)).toEqual(new Array(32).fill(0));
      });

      it('seckey が 32B 以外なら例外', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        await expect(nosskey.importNostrKey(new Uint8Array(31))).rejects.toThrow(
          'importNostrKey: seckey must be a 32-byte Uint8Array'
        );
      });

      it('seckey が全 0 なら例外', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        await expect(nosskey.importNostrKey(new Uint8Array(32))).rejects.toThrow(
          'importNostrKey: invalid seckey (all zeros)'
        );
      });

      it('getPrfSecret 第3引数が WRAP_SALT', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        const spy = vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: new Uint8Array(),
        });
        await nosskey.importNostrKey(hexToBytes(TV_SECKEY_HEX));
        expect(spy.mock.calls[0][2]).toEqual(hexToBytes(WRAP_SALT_HEX));
      });

      it('username オプションが反映される', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: new Uint8Array(),
        });
        const result = await nosskey.importNostrKey(hexToBytes(TV_SECKEY_HEX), undefined, {
          username: 'alice',
        });
        expect(result.username).toBe('alice');
      });

      it('credentialId 明示指定時、その hex が NostrKeyInfo.credentialId に入る', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: new Uint8Array([0xff, 0xff]),
        });
        const result = await nosskey.importNostrKey(hexToBytes(TV_SECKEY_HEX), credId);
        expect(result.credentialId).toBe(bytesToHex(credId));
      });

      it('PRF 出力が全 0 なら例外（KEK ゼロ拒否）', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: new Uint8Array(32),
          id: new Uint8Array(),
        });
        await expect(nosskey.importNostrKey(hexToBytes(TV_SECKEY_HEX))).rejects.toThrow(
          'Invalid PRF output: all zeros'
        );
      });
    });

    describe('exportNostrKey: 固定 wrapped payload からの復号（実値ベクトルテスト）', () => {
      it('固定 wrapped payload + 固定 KEK → 元の seckey hex を完全復元', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: {
            v: 1,
            alg: 'nip44-v2',
            payload: TV_PAYLOAD_B64,
          },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        const exported = await nosskey.exportNostrKey(keyInfo);
        expect(exported).toBe(TV_SECKEY_HEX);
      });

      it('signEventWithKeyInfo は wrapped payload を復号して取り出した秘密鍵で署名する', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        const signed = await nosskey.signEventWithKeyInfo(
          { kind: 1, content: 'test', tags: [] },
          keyInfo
        );
        expect(signed.id).toBe('wrap-mock-id');
        expect(signed.sig).toBe('wrap-mock-sig');

        // seckeySigner が「復号された元の seckey hex」で呼ばれたことを確認
        const calls = vi.mocked(seckeySigner).mock.calls;
        const calledWithSeckey = calls.some(([sk]) => sk === TV_SECKEY_HEX);
        expect(calledWithSeckey).toBe(true);
      });

      it('nip44Encrypt → nip44Decrypt 自己ラウンドトリップ（wrap モード越し）', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        nosskey.setCurrentKeyInfo(keyInfo);
        const prfHandler = await import('./prf-handler.js');
        // 各呼び出しで新規バッファを返す（#getSecretKey が KEK を fill(0) するため）
        vi.spyOn(prfHandler, 'getPrfSecret').mockImplementation(async () => ({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        }));

        // peer 鍵は別の任意の seckey の pubkey
        const { schnorr } = await import('@noble/curves/secp256k1.js');
        const peerSk = new Uint8Array(32).fill(0x55);
        const peerPubHex = bytesToHex(schnorr.getPublicKey(peerSk));

        const ciphertext = await nosskey.nip44Encrypt(peerPubHex, 'hello wrap');
        expect(await nosskey.nip44Decrypt(peerPubHex, ciphertext)).toBe('hello wrap');
      });
    });

    describe('wrap モードの改竄検知', () => {
      it('wrapped.payload を 1 文字書き換え → exportNostrKey が MAC エラー', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        // ciphertext 部の base64 文字を1つ書き換える。先頭 ~12 文字はバージョン+nonce
        // の base64 表現なのでスキップ、後ろは MAC なのでスキップ。中間の文字を狙う。
        const idx = Math.floor(TV_PAYLOAD_B64.length / 2);
        const orig = TV_PAYLOAD_B64[idx];
        const swap = orig === 'A' ? 'B' : 'A';
        const tampered = TV_PAYLOAD_B64.slice(0, idx) + swap + TV_PAYLOAD_B64.slice(idx + 1);

        const credId = new Uint8Array(4);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: tampered },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        await expect(nosskey.exportNostrKey(keyInfo)).rejects.toThrow(/NIP-44/);
      });

      it('wrapped.alg !== "nip44-v2" → "Unsupported wrap algorithm" 例外', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(4);
        const keyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v3', payload: TV_PAYLOAD_B64 },
        } as unknown as NostrKeyInfo;
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        await expect(nosskey.exportNostrKey(keyInfo)).rejects.toThrow(
          'Unsupported wrap algorithm: nip44-v3'
        );
      });
    });

    describe('PRF 直接モード回帰', () => {
      it('createNostrKey は wrapped を生成しない', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: new Uint8Array(32).fill(42),
          id: mockCredentialId,
        });

        const result = await nosskey.createNostrKey(mockCredentialId);
        expect(result.wrapped).toBeUndefined();
        expect(result.salt).toBe('6e6f7374722d70776b'); // 直接モード salt
      });
    });

    describe('wrap モードと KeyCache の相互作用', () => {
      it('キャッシュ有効時、2回目の操作で getPrfSecret が呼ばれない', async () => {
        const nosskey = new NosskeyManager({
          cacheOptions: { enabled: true },
          storageOptions: { enabled: false },
        });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        // 各呼び出しで新規バッファを返す（fill(0) によるバッファ破壊回避）
        const spy = vi.spyOn(prfHandler, 'getPrfSecret').mockImplementation(async () => ({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        }));

        const r1 = await nosskey.exportNostrKey(keyInfo);
        expect(r1).toBe(TV_SECKEY_HEX);
        expect(spy).toHaveBeenCalledTimes(1);

        const r2 = await nosskey.exportNostrKey(keyInfo);
        expect(r2).toBe(TV_SECKEY_HEX);
        expect(spy).toHaveBeenCalledTimes(1); // 2回目はキャッシュヒット
      });

      it('clearCachedKey 後は再度 getPrfSecret + NIP-44 復号が走る', async () => {
        const nosskey = new NosskeyManager({
          cacheOptions: { enabled: true },
          storageOptions: { enabled: false },
        });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        // 各呼び出しで新規バッファを返す
        const spy = vi.spyOn(prfHandler, 'getPrfSecret').mockImplementation(async () => ({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        }));

        await nosskey.exportNostrKey(keyInfo);
        nosskey.clearCachedKey(credId);
        await nosskey.exportNostrKey(keyInfo);
        expect(spy).toHaveBeenCalledTimes(2);
      });
    });
  });
});
