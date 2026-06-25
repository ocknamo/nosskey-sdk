import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyCache } from './key-cache.js';
import type { KeyCacheOptions } from './types.js';

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

  describe('コンストラクタとオプション設定', () => {
    it('デフォルトオプションで初期化される', () => {
      keyCache = new KeyCache();
      const options = keyCache.getCacheOptions();

      expect(options.enabled).toBe(false);
      expect(options.timeoutMs).toBe(5 * 60 * 1000); // 5分
    });

    it('コンストラクタでオプションを指定できる', () => {
      const customOptions: Partial<KeyCacheOptions> = {
        enabled: true,
        timeoutMs: 10 * 60 * 1000, // 10分
      };

      keyCache = new KeyCache(customOptions);
      const options = keyCache.getCacheOptions();

      expect(options.enabled).toBe(true);
      expect(options.timeoutMs).toBe(10 * 60 * 1000);
    });

    it('部分的なオプション指定でもデフォルト値がマージされる', () => {
      keyCache = new KeyCache({ enabled: true });
      const options = keyCache.getCacheOptions();

      expect(options.enabled).toBe(true);
      expect(options.timeoutMs).toBe(5 * 60 * 1000); // デフォルト値
    });
  });

  describe('setCacheOptions', () => {
    beforeEach(() => {
      keyCache = new KeyCache();
    });

    it('キャッシュオプションを更新できる', () => {
      keyCache.setCacheOptions({ enabled: true, timeoutMs: 15 * 60 * 1000 });
      const options = keyCache.getCacheOptions();

      expect(options.enabled).toBe(true);
      expect(options.timeoutMs).toBe(15 * 60 * 1000);
    });

    it('部分的な更新でも既存の設定がマージされる', () => {
      keyCache.setCacheOptions({ enabled: true });
      keyCache.setCacheOptions({ timeoutMs: 20 * 60 * 1000 });
      const options = keyCache.getCacheOptions();

      expect(options.enabled).toBe(true);
      expect(options.timeoutMs).toBe(20 * 60 * 1000);
    });

    it('enabled=falseに設定すると全てのキャッシュがクリアされる', () => {
      // キャッシュを有効にして鍵を保存
      keyCache.setCacheOptions({ enabled: true });
      const testKey = new Uint8Array([1, 2, 3, 4]);
      const testCredentialId = 'test-credential-id';
      keyCache.setKey(testCredentialId, testKey);

      // 鍵が保存されていることを確認
      expect(keyCache.getKey(testCredentialId)).toEqual(testKey);

      // キャッシュを無効化
      keyCache.setCacheOptions({ enabled: false });

      // キャッシュが有効になっても、以前のデータは取得できない
      keyCache.setCacheOptions({ enabled: true });
      expect(keyCache.getKey(testCredentialId)).toBeUndefined();
    });

    it('timeoutMsのみを変更した場合でもキャッシュがクリアされる', () => {
      // キャッシュを有効にして鍵を保存
      keyCache.setCacheOptions({ enabled: true, timeoutMs: 10 * 60 * 1000 });
      const testKey = new Uint8Array([1, 2, 3, 4]);
      const testCredentialId = 'test-credential-id';
      keyCache.setKey(testCredentialId, testKey);

      // 鍵が保存されていることを確認
      expect(keyCache.getKey(testCredentialId)).toEqual(testKey);

      // timeoutMsのみを変更
      keyCache.setCacheOptions({ timeoutMs: 20 * 60 * 1000 });

      // キャッシュがクリアされていることを確認
      expect(keyCache.getKey(testCredentialId)).toBeUndefined();
    });

    it('複数の設定を同時に変更した場合でもキャッシュがクリアされる', () => {
      // キャッシュを有効にして鍵を保存
      keyCache.setCacheOptions({ enabled: true, timeoutMs: 5 * 60 * 1000 });
      const testKey = new Uint8Array([1, 2, 3, 4]);
      const testCredentialId = 'test-credential-id';
      keyCache.setKey(testCredentialId, testKey);

      // 鍵が保存されていることを確認
      expect(keyCache.getKey(testCredentialId)).toEqual(testKey);

      // 複数の設定を同時に変更
      keyCache.setCacheOptions({ enabled: true, timeoutMs: 15 * 60 * 1000 });

      // キャッシュがクリアされていることを確認
      expect(keyCache.getKey(testCredentialId)).toBeUndefined();
    });

    it('空のオプションを設定した場合はキャッシュがクリアされない', () => {
      // キャッシュを有効にして鍵を保存
      keyCache.setCacheOptions({ enabled: true });
      const testKey = new Uint8Array([1, 2, 3, 4]);
      const testCredentialId = 'test-credential-id';
      keyCache.setKey(testCredentialId, testKey);

      // 鍵が保存されていることを確認
      expect(keyCache.getKey(testCredentialId)).toEqual(testKey);

      // 空のオプションを設定
      keyCache.setCacheOptions({});

      // キャッシュがクリアされないことを確認
      expect(keyCache.getKey(testCredentialId)).toEqual(testKey);
    });
  });

  describe('isEnabled', () => {
    it('キャッシュが有効な場合にtrueを返す', () => {
      keyCache = new KeyCache({ enabled: true });
      expect(keyCache.isEnabled()).toBe(true);
    });

    it('キャッシュが無効な場合にfalseを返す', () => {
      keyCache = new KeyCache({ enabled: false });
      expect(keyCache.isEnabled()).toBe(false);
    });
  });

  describe('setKey と getKey', () => {
    beforeEach(() => {
      keyCache = new KeyCache({ enabled: true, timeoutMs: 10 * 60 * 1000 });
    });

    it('Uint8Array形式のcredentialIdで鍵を保存・取得できる', () => {
      const testKey = new Uint8Array([1, 2, 3, 4, 5]);
      const credentialId = new Uint8Array([10, 11, 12, 13]);

      keyCache.setKey(credentialId, testKey);
      const retrievedKey = keyCache.getKey(credentialId);

      expect(retrievedKey).toEqual(testKey);
      // 異なるインスタンスであることを確認（コピーされている）
      expect(retrievedKey).not.toBe(testKey);
    });

    it('string形式のcredentialIdで鍵を保存・取得できる', () => {
      const testKey = new Uint8Array([5, 6, 7, 8, 9]);
      const credentialId = 'string-credential-id';

      keyCache.setKey(credentialId, testKey);
      const retrievedKey = keyCache.getKey(credentialId);

      expect(retrievedKey).toEqual(testKey);
    });

    it('キャッシュが無効な場合は保存・取得されない', () => {
      keyCache = new KeyCache({ enabled: false });
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);
      const retrievedKey = keyCache.getKey(credentialId);

      expect(retrievedKey).toBeUndefined();
    });

    it('存在しない鍵の取得時はundefinedを返す', () => {
      const result = keyCache.getKey('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('有効期限の処理', () => {
    beforeEach(() => {
      keyCache = new KeyCache({ enabled: true, timeoutMs: 10 * 60 * 1000 }); // 10分
    });

    it('有効期限内の鍵は取得できる', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);

      // 5分経過
      vi.advanceTimersByTime(5 * 60 * 1000);

      const retrievedKey = keyCache.getKey(credentialId);
      expect(retrievedKey).toEqual(testKey);
    });

    it('有効期限切れの鍵は取得できない', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);

      // 11分経過（10分のタイムアウトを超過）
      vi.advanceTimersByTime(11 * 60 * 1000);

      const retrievedKey = keyCache.getKey(credentialId);
      expect(retrievedKey).toBeUndefined();
    });

    it('有効期限切れの鍵は自動的にキャッシュから削除される', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);

      // 有効期限を確認するために一度アクセス
      keyCache.getKey(credentialId);

      // 期限切れにする
      vi.advanceTimersByTime(11 * 60 * 1000);

      // 期限切れでアクセス（内部でキャッシュから削除される）
      keyCache.getKey(credentialId);

      // 時間を戻しても取得できないことを確認（削除されているため）
      vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
      expect(keyCache.getKey(credentialId)).toBeUndefined();
    });

    it('タイムアウト時間を動的に変更できる', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      // 最初は10分のタイムアウト
      keyCache.setKey(credentialId, testKey);

      // タイムアウトを1分に変更
      keyCache.setCacheOptions({ timeoutMs: 1 * 60 * 1000 });

      // 新しい鍵を保存（古い鍵は上書きされ、新しいタイムアウト設定が適用される）
      const newTestKey = new Uint8Array([4, 5, 6]);
      keyCache.setKey(credentialId, newTestKey);

      // 2分経過
      vi.advanceTimersByTime(2 * 60 * 1000);

      // 新しい鍵（1分タイムアウト）は期限切れ
      expect(keyCache.getKey(credentialId)).toBeUndefined();
    });
  });

  describe('clearCachedKey', () => {
    beforeEach(() => {
      keyCache = new KeyCache({ enabled: true });
    });

    it('指定した鍵のキャッシュをクリアできる', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);

      // 鍵をクリア
      keyCache.clearCachedKey(credentialId);

      // クリアした鍵は取得できない
      expect(keyCache.getKey(credentialId)).toBeUndefined();
    });

    it('Uint8Array形式のcredentialIdでもクリアできる', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = new Uint8Array([10, 11, 12]);

      keyCache.setKey(credentialId, testKey);
      keyCache.clearCachedKey(credentialId);

      expect(keyCache.getKey(credentialId)).toBeUndefined();
    });

    it('存在しない鍵のクリア要求でもエラーにならない', () => {
      expect(() => {
        keyCache.clearCachedKey('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('clearAllCachedKeys', () => {
    beforeEach(() => {
      keyCache = new KeyCache({ enabled: true });
    });

    it('キャッシュをクリアできる', () => {
      const testKey = new Uint8Array([1, 2, 3]);
      const credentialId = 'test-id';

      keyCache.setKey(credentialId, testKey);

      // 全てクリア
      keyCache.clearAllCachedKeys();

      // 鍵が取得できない
      expect(keyCache.getKey(credentialId)).toBeUndefined();
    });

    it('空のキャッシュに対してもエラーにならない', () => {
      expect(() => {
        keyCache.clearAllCachedKeys();
      }).not.toThrow();
    });
  });
});
