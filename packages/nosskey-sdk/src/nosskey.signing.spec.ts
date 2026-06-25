import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager } from './nosskey.js';
import {
  installWebAuthnMocks,
  mockCredentialId,
  mockPrfResultValue,
} from './nosskey.test-helpers.js';
import type { NostrEvent, NostrKeyInfo } from './types.js';
import { bytesToHex, hexToBytes } from './utils.js';

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
  let webauthn: ReturnType<typeof installWebAuthnMocks>;

  beforeEach(() => {
    webauthn = installWebAuthnMocks();
  });

  afterEach(() => {
    webauthn.restore();
    vi.clearAllMocks();
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
});
