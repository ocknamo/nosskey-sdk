/**
 * key-registry 純粋関数のテスト
 * @packageDocumentation
 */
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_REGISTRY_STORAGE_KEY,
  isNostrKeyInfo,
  isSameEntry,
  loadRegistry,
  normalizeEntry,
  persistRegistry,
  removeEntry,
  upsertEntry,
} from './key-registry.js';
import type { NostrKeyInfo } from './types.js';

const STANDARD_SALT = '6e6f7374722d70776b';
const LEGACY_SALT = '6e6f7374722d6b6579';
const WRAP_SALT = '6e6f7374722d70776b2d77726170';

function directKey(pubkey: string, credentialId = 'cred-a'): NostrKeyInfo {
  return { credentialId, pubkey, salt: STANDARD_SALT };
}

function wrapKey(pubkey: string, credentialId: string, payload = 'pl'): NostrKeyInfo {
  return {
    credentialId,
    pubkey,
    salt: WRAP_SALT,
    wrapped: { v: 1, alg: 'nip44-v2', payload },
  };
}

/** メモリ上の Storage モック。 */
function memStorage(initial: Record<string, string> = {}): Storage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

describe('isNostrKeyInfo', () => {
  it('正常な直接モード/ wrap モードを受理する', () => {
    expect(isNostrKeyInfo(directKey('pk'))).toBe(true);
    expect(isNostrKeyInfo(wrapKey('pk', 'c'))).toBe(true);
  });

  it('必須フィールド欠落・型違反を弾く', () => {
    expect(isNostrKeyInfo(null)).toBe(false);
    expect(isNostrKeyInfo({})).toBe(false);
    expect(isNostrKeyInfo({ credentialId: 'c', pubkey: 'p' })).toBe(false); // salt なし
    expect(isNostrKeyInfo({ credentialId: 1, pubkey: 'p', salt: 's' })).toBe(false);
    expect(isNostrKeyInfo({ credentialId: 'c', pubkey: 'p', salt: 's', username: 1 })).toBe(false);
  });

  it('壊れた wrapped を弾く（復元不能要素の混入防止）', () => {
    const base = { credentialId: 'c', pubkey: 'p', salt: WRAP_SALT };
    expect(isNostrKeyInfo({ ...base, wrapped: { v: 2, alg: 'nip44-v2', payload: 'x' } })).toBe(
      false
    );
    expect(isNostrKeyInfo({ ...base, wrapped: { v: 1, alg: 'aes', payload: 'x' } })).toBe(false);
    expect(isNostrKeyInfo({ ...base, wrapped: { v: 1, alg: 'nip44-v2' } })).toBe(false);
    expect(isNostrKeyInfo({ ...base, wrapped: null })).toBe(false);
  });
});

describe('normalizeEntry', () => {
  it('旧誤値・未設定 salt を標準値へ正規化し、wrap salt は維持する', () => {
    expect(normalizeEntry({ credentialId: 'c', pubkey: 'p', salt: LEGACY_SALT }).salt).toBe(
      STANDARD_SALT
    );
    expect(normalizeEntry({ credentialId: 'c', pubkey: 'p', salt: '' }).salt).toBe(STANDARD_SALT);
    expect(normalizeEntry(wrapKey('p', 'c')).salt).toBe(WRAP_SALT);
  });

  it('入力を変更しない', () => {
    const input = { credentialId: 'c', pubkey: 'p', salt: LEGACY_SALT };
    normalizeEntry(input);
    expect(input.salt).toBe(LEGACY_SALT);
  });
});

describe('isSameEntry', () => {
  it('pubkey + credentialId の複合で同一判定する', () => {
    expect(
      isSameEntry({ pubkey: 'p', credentialId: 'c' }, { pubkey: 'p', credentialId: 'c' })
    ).toBe(true);
    // 同一 pubkey でも credentialId が異なれば別エントリ
    expect(
      isSameEntry({ pubkey: 'p', credentialId: 'c1' }, { pubkey: 'p', credentialId: 'c2' })
    ).toBe(false);
    expect(
      isSameEntry({ pubkey: 'p1', credentialId: 'c' }, { pubkey: 'p2', credentialId: 'c' })
    ).toBe(false);
  });
});

describe('upsertEntry', () => {
  it('新規は末尾に追加する', () => {
    const next = upsertEntry([directKey('p1')], directKey('p2', 'cred-b'));
    expect(next.map((k) => k.pubkey)).toEqual(['p1', 'p2']);
  });

  it('同一 pubkey でも credentialId が異なれば両方保持する（wrap 暗号文を捨てない）', () => {
    const a = wrapKey('samepk', 'cred-1', 'payload-1');
    const b = wrapKey('samepk', 'cred-2', 'payload-2');
    const next = upsertEntry([a], b);
    expect(next).toHaveLength(2);
    expect(next.map((k) => k.wrapped?.payload).sort()).toEqual(['payload-1', 'payload-2']);
  });

  it('同一 pubkey+credentialId は更新し、username は新規が無ければ既存を残す', () => {
    const existing = { ...directKey('p1'), username: 'alice' };
    const updated = upsertEntry([existing], directKey('p1')); // username 無し
    expect(updated).toHaveLength(1);
    expect(updated[0].username).toBe('alice');

    const renamed = upsertEntry([existing], { ...directKey('p1'), username: 'bob' });
    expect(renamed[0].username).toBe('bob');
  });

  it('入力配列を変更しない', () => {
    const list = [directKey('p1')];
    upsertEntry(list, directKey('p2', 'cred-b'));
    expect(list).toHaveLength(1);
  });
});

describe('removeEntry', () => {
  it('pubkey + credentialId 一致のみ削除する', () => {
    const list = [wrapKey('p', 'c1'), wrapKey('p', 'c2')];
    const next = removeEntry(list, 'p', 'c1');
    expect(next).toHaveLength(1);
    expect(next[0].credentialId).toBe('c2');
  });
});

describe('loadRegistry / persistRegistry', () => {
  it('ラウンドトリップでき、壊れた要素は除外・salt 正規化される', () => {
    const storage = memStorage();
    const list = [{ ...directKey('p1'), salt: LEGACY_SALT }, wrapKey('p2', 'c2')];
    persistRegistry(storage, DEFAULT_REGISTRY_STORAGE_KEY, list);
    const loaded = loadRegistry(storage, DEFAULT_REGISTRY_STORAGE_KEY);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].salt).toBe(STANDARD_SALT); // 正規化
  });

  it('キー不在は空配列', () => {
    expect(loadRegistry(memStorage(), DEFAULT_REGISTRY_STORAGE_KEY)).toEqual([]);
  });

  it('配列でない/壊れた JSON は空配列にフォールバックする', () => {
    const s1 = memStorage({ [DEFAULT_REGISTRY_STORAGE_KEY]: '{"not":"array"}' });
    const s2 = memStorage({ [DEFAULT_REGISTRY_STORAGE_KEY]: 'not json' });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(loadRegistry(s1, DEFAULT_REGISTRY_STORAGE_KEY)).toEqual([]);
    expect(loadRegistry(s2, DEFAULT_REGISTRY_STORAGE_KEY)).toEqual([]);
    vi.restoreAllMocks();
  });

  it('非 NostrKeyInfo 要素は読み込み時に除外される', () => {
    const storage = memStorage({
      [DEFAULT_REGISTRY_STORAGE_KEY]: JSON.stringify([directKey('p1'), { bogus: true }]),
    });
    const loaded = loadRegistry(storage, DEFAULT_REGISTRY_STORAGE_KEY);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].pubkey).toBe('p1');
  });

  it('setItem 失敗を握り潰す（throw しない）', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as Storage;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      persistRegistry(storage, DEFAULT_REGISTRY_STORAGE_KEY, [directKey('p')])
    ).not.toThrow();
    vi.restoreAllMocks();
  });
});
