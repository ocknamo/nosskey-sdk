import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager } from './nosskey.js';
import { installWebAuthnMocks, mockCredentialId } from './nosskey.test-helpers.js';
import type { NostrKeyInfo } from './types.js';
import { bytesToHex } from './utils.js';

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

  describe('マルチアカウント登録簿（wrap 鍵喪失ガード）', () => {
    let mockLocalStorage: { [key: string]: string };

    const wrapKeyInfo = (pubkey: string, credentialId: string, payload: string): NostrKeyInfo => ({
      credentialId,
      pubkey,
      salt: '6e6f7374722d70776b2d77726170',
      wrapped: { v: 1, alg: 'nip44-v2', payload },
    });

    beforeEach(() => {
      mockLocalStorage = {};
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          setItem: vi.fn((key, value) => {
            mockLocalStorage[key] = value;
          }),
          getItem: vi.fn((key) => (key in mockLocalStorage ? mockLocalStorage[key] : null)),
          removeItem: vi.fn((key) => {
            delete mockLocalStorage[key];
          }),
        },
        configurable: true,
      });
    });

    it('2 件目を current に設定しても 1 件目の wrap 暗号文が登録簿に残る', () => {
      const nosskey = new NosskeyManager();
      const a = wrapKeyInfo('pk-a', 'cred-a', 'payload-a');
      const b = wrapKeyInfo('pk-b', 'cred-b', 'payload-b');

      nosskey.setCurrentKeyInfo(a);
      nosskey.setCurrentKeyInfo(b);

      const list = nosskey.listKeyInfos();
      expect(list.map((k) => k.pubkey).sort()).toEqual(['pk-a', 'pk-b']);
      expect(list.find((k) => k.pubkey === 'pk-a')?.wrapped?.payload).toBe('payload-a');
      // 別キーに保存されている
      expect(mockLocalStorage.nosskey_accounts).toBeDefined();
    });

    it('同一 pubkey でも credentialId が異なれば両方の wrapped を保持する', () => {
      const nosskey = new NosskeyManager();
      nosskey.setCurrentKeyInfo(wrapKeyInfo('same', 'cred-1', 'p1'));
      nosskey.setCurrentKeyInfo(wrapKeyInfo('same', 'cred-2', 'p2'));

      const list = nosskey.listKeyInfos();
      expect(list).toHaveLength(2);
      expect(list.map((k) => k.wrapped?.payload).sort()).toEqual(['p1', 'p2']);
    });

    it('clearCurrentKeyInfo（logout）は current を消すが登録簿は残す', () => {
      const nosskey = new NosskeyManager();
      const a = wrapKeyInfo('pk-a', 'cred-a', 'payload-a');
      nosskey.setCurrentKeyInfo(a);

      nosskey.clearCurrentKeyInfo();

      expect(nosskey.getCurrentKeyInfo()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('nosskey_keyinfo');
      // 登録簿は保持され再ログイン可能
      expect(nosskey.listKeyInfos().map((k) => k.pubkey)).toEqual(['pk-a']);
      expect(mockLocalStorage.nosskey_accounts).toBeDefined();
    });

    it('clearStoredKeyInfo（完全ワイプ）は current も登録簿も消す', () => {
      const nosskey = new NosskeyManager();
      nosskey.setCurrentKeyInfo(wrapKeyInfo('pk-a', 'cred-a', 'payload-a'));

      nosskey.clearStoredKeyInfo();

      expect(nosskey.getCurrentKeyInfo()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('nosskey_keyinfo');
      expect(localStorage.removeItem).toHaveBeenCalledWith('nosskey_accounts');
      expect(nosskey.listKeyInfos()).toEqual([]);
    });

    it('removeKeyInfo は pubkey + credentialId 一致のみ削除する', () => {
      const nosskey = new NosskeyManager();
      nosskey.setCurrentKeyInfo(wrapKeyInfo('same', 'cred-1', 'p1'));
      nosskey.setCurrentKeyInfo(wrapKeyInfo('same', 'cred-2', 'p2'));

      nosskey.removeKeyInfo('same', 'cred-1');

      const list = nosskey.listKeyInfos();
      expect(list).toHaveLength(1);
      expect(list[0].credentialId).toBe('cred-2');
    });

    it('backupKeyInfo は wrapped を含むディープコピーを返し、改変しても内部に影響しない', () => {
      const nosskey = new NosskeyManager();
      const a = wrapKeyInfo('pk-a', 'cred-a', 'payload-a');
      nosskey.setCurrentKeyInfo(a);

      // 引数なし: current のバックアップ
      const backup = nosskey.backupKeyInfo();
      expect(backup?.wrapped?.payload).toBe('payload-a');

      // 返り値を改変しても登録簿/current は不変
      if (backup?.wrapped) backup.wrapped.payload = 'tampered';
      expect(nosskey.backupKeyInfo()?.wrapped?.payload).toBe('payload-a');
      expect(nosskey.listKeyInfos()[0].wrapped?.payload).toBe('payload-a');

      // pubkey 指定でも取得できる / 該当なしは null
      expect(nosskey.backupKeyInfo('pk-a', 'cred-a')?.wrapped?.payload).toBe('payload-a');
      expect(nosskey.backupKeyInfo('nope')).toBeNull();
    });

    it('単一スロットの既存ユーザーは登録簿キー不在時に一度だけ移行される', () => {
      // 旧ユーザー: current スロットのみ存在、登録簿キーは無い
      mockLocalStorage.nosskey_keyinfo = JSON.stringify(wrapKeyInfo('pk-old', 'cred-old', 'p-old'));

      const nosskey = new NosskeyManager();
      const list = nosskey.listKeyInfos();

      expect(list.map((k) => k.pubkey)).toEqual(['pk-old']);
      // 登録簿として永続化されている
      expect(mockLocalStorage.nosskey_accounts).toBeDefined();
      expect(JSON.parse(mockLocalStorage.nosskey_accounts)).toHaveLength(1);
    });

    it('登録簿が空配列（削除済み）なら current が残っていても蘇生しない', () => {
      mockLocalStorage.nosskey_keyinfo = JSON.stringify(wrapKeyInfo('pk-old', 'cred-old', 'p-old'));
      mockLocalStorage.nosskey_accounts = JSON.stringify([]); // 全削除済みの状態

      const nosskey = new NosskeyManager();
      expect(nosskey.listKeyInfos()).toEqual([]);
    });

    it('registryEnabled=false では登録簿を読み書きしない（旧単一スロット挙動）', () => {
      const nosskey = new NosskeyManager({ storageOptions: { registryEnabled: false } });
      nosskey.setCurrentKeyInfo(wrapKeyInfo('pk-a', 'cred-a', 'payload-a'));

      expect(mockLocalStorage.nosskey_accounts).toBeUndefined();
      expect(nosskey.listKeyInfos()).toEqual([]);
    });

    it('storage 差し替え時に登録簿の in-memory キャッシュが破棄され読み直される', () => {
      const makeStore = (initial: { [k: string]: string } = {}): Storage => {
        const m: { [k: string]: string } = { ...initial };
        return {
          getItem: (k: string) => (k in m ? m[k] : null),
          setItem: (k: string, v: string) => {
            m[k] = v;
          },
          removeItem: (k: string) => {
            delete m[k];
          },
          clear: () => undefined,
          key: () => null,
          length: 0,
        } as Storage;
      };

      const storeA = makeStore();
      const nosskey = new NosskeyManager({ storageOptions: { storage: storeA } });
      nosskey.setCurrentKeyInfo(wrapKeyInfo('pk-a', 'cred-a', 'payload-a'));
      expect(nosskey.listKeyInfos().map((k) => k.pubkey)).toEqual(['pk-a']);

      // 別 storage（別パーティション）へ差し替え → 登録簿キャッシュは破棄される
      const storeB = makeStore({
        nosskey_accounts: JSON.stringify([wrapKeyInfo('pk-b', 'cred-b', 'payload-b')]),
      });
      nosskey.setStorageOptions({ storage: storeB });
      expect(nosskey.listKeyInfos().map((k) => k.pubkey)).toEqual(['pk-b']);
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
});
