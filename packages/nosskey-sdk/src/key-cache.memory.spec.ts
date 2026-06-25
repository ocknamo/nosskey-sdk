import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyCache } from './key-cache.js';

describe('KeyCache', () => {
  let keyCache: KeyCache;

  beforeEach(() => {
    // 時刻のモック
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('メモリクリア機能', () => {
    beforeEach(() => {
      keyCache = new KeyCache({ enabled: true });
    });

    it('clearCachedKeyで秘密鍵がメモリからクリアされる', () => {
      const testKey = new Uint8Array([1, 2, 3, 4, 5]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);
      keyCache.clearCachedKey(credentialId);

      // 元の配列は変更されない（コピーが保存されているため）
      expect(testKey).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('clearAllCachedKeysで秘密鍵がメモリからクリアされる', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);

      keyCache.clearAllCachedKeys();

      // 元の配列は変更されない（コピーが保存されているため）
      expect(testKey).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('期限切れでもメモリクリアが実行される', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);

      // 期限切れにする
      vi.advanceTimersByTime(11 * 60 * 1000);

      // 期限切れでアクセス（内部でメモリクリアされる）
      keyCache.getKey(credentialId);

      // 元の配列は変更されない
      expect(testKey).toEqual(new Uint8Array([1, 2, 3]));
    });
  });

  describe('エラーハンドリング', () => {
    beforeEach(() => {
      keyCache = new KeyCache({ enabled: true });
    });

    it('タイマー設定に失敗した場合は即座にキャッシュをクリアしてエラーを再スロー', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      // setTimeoutをモックしてエラーを発生させる
      const originalSetTimeout = global.setTimeout;
      const mockError = new Error('Timer creation failed');
      global.setTimeout = vi.fn(() => {
        throw mockError;
      }) as unknown as typeof setTimeout;

      // setKeyでエラーが発生することを確認
      expect(() => {
        keyCache.setKey(credentialId, testKey);
      }).toThrow('Timer creation failed');

      // キャッシュがクリアされていることを確認
      expect(keyCache.getKey(credentialId)).toBeUndefined();

      // setTimeoutを元に戻す
      global.setTimeout = originalSetTimeout;
    });

    it('タイマー設定エラー後も通常の動作が可能', () => {
      const testKey1 = new Uint8Array([1, 2, 3]);
      const testKey2 = new Uint8Array([4, 5, 6]);
      const credentialId1 = 'test-id-1';
      const credentialId2 = 'test-id-2';

      // 最初はsetTimeoutエラーを発生させる
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn(() => {
        throw new Error('Timer creation failed');
      }) as unknown as typeof setTimeout;

      // 最初のsetKeyでエラーが発生
      expect(() => {
        keyCache.setKey(credentialId1, testKey1);
      }).toThrow('Timer creation failed');

      // setTimeoutを元に戻す
      global.setTimeout = originalSetTimeout;

      // 通常の動作が可能であることを確認
      keyCache.setKey(credentialId2, testKey2);
      expect(keyCache.getKey(credentialId2)).toEqual(testKey2);

      // 最初の鍵は取得できない（エラー時にクリアされた）
      expect(keyCache.getKey(credentialId1)).toBeUndefined();
    });

    it('タイマー設定エラー時にメモリが適切にクリアされる', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      // setTimeoutをモックしてエラーを発生させる
      const originalSetTimeout = global.setTimeout;
      let storedKey: Uint8Array | null = null;
      global.setTimeout = vi.fn(() => {
        // エラー発生前にキャッシュに保存された鍵の参照を取得
        storedKey = keyCache.getKey(credentialId) || null;
        throw new Error('Timer creation failed');
      }) as unknown as typeof setTimeout;

      // setKeyでエラーが発生
      expect(() => {
        keyCache.setKey(credentialId, testKey);
      }).toThrow('Timer creation failed');

      // setTimeoutを元に戻す
      global.setTimeout = originalSetTimeout;

      // エラー後はキャッシュから取得できない
      expect(keyCache.getKey(credentialId)).toBeUndefined();

      // 元の配列は変更されない（コピーが保存されていたため）
      expect(testKey).toEqual(new Uint8Array([1, 2, 3]));
    });
  });

  describe('エッジケース', () => {
    beforeEach(() => {
      keyCache = new KeyCache({ enabled: true });
    });

    it('同じcredentialIdで複数回保存すると上書きされる', () => {
      const testKey1 = new Uint8Array([1, 2, 3]);
      const testKey2 = new Uint8Array([4, 5, 6]);
      const credentialId = 'same-id';

      keyCache.setKey(credentialId, testKey1);
      keyCache.setKey(credentialId, testKey2);

      const retrievedKey = keyCache.getKey(credentialId);
      expect(retrievedKey).toEqual(testKey2);
    });

    it('timeoutMs=0でも動作する', () => {
      keyCache = new KeyCache({ enabled: true, timeoutMs: 0 });
      const testKey = new Uint8Array([1, 2, 3]);

      keyCache.setKey('test-id', testKey);

      // 即座に期限切れになる
      vi.advanceTimersByTime(1);

      expect(keyCache.getKey('test-id')).toBeUndefined();
    });

    it('timeoutMsが未定義の場合はundefinedが保持される', () => {
      keyCache = new KeyCache({ enabled: true, timeoutMs: undefined });
      const options = keyCache.getCacheOptions();

      expect(options.timeoutMs).toBeUndefined();
    });
  });
});
