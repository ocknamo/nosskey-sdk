import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyCache } from './key-cache.js';
import { NosskeyManager } from './nosskey.js';
import type { NostrKeyInfo } from './types.js';

/**
 * `reloadCurrentKeyInfo()` の仕様。
 *
 * 署名 iframe は Storage Access のグラント（ドキュメント単位）を捨てないために
 * 作り直さずに生かし続ける。そのぶん in-memory の current が古くなるので、
 * 「ストレージを見直す」操作だけを非破壊で提供するのがこの API。
 */

const SALT = '6e6f7374722d70776b';

function keyInfo(pubkey: string, credentialId = 'cred-a'): NostrKeyInfo {
  return { credentialId, pubkey, salt: SALT };
}

/** setItem/getItem/removeItem だけを持つ最小の Storage 実装。 */
function makeStorage(initial: Record<string, string> = {}): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    map,
    length: 0,
    clear: () => map.clear(),
    key: () => null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  } as Storage & { map: Map<string, string> };
}

function makeManager(storage: Storage): NosskeyManager {
  return new NosskeyManager({
    storageOptions: { enabled: true, storage, registryEnabled: false },
  });
}

describe('NosskeyManager.reloadCurrentKeyInfo', () => {
  let clearAll: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearAll = vi.spyOn(KeyCache.prototype, 'clearAllCachedKeys');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('別タブで差し替えられた鍵情報を読み直す', () => {
    const storage = makeStorage({ nosskey_keyinfo: JSON.stringify(keyInfo('aaaa')) });
    const manager = makeManager(storage);
    expect(manager.getCurrentKeyInfo()?.pubkey).toBe('aaaa');

    storage.setItem('nosskey_keyinfo', JSON.stringify(keyInfo('bbbb')));
    // getCurrentKeyInfo は in-memory を返し続ける（この差が本 API の存在理由）。
    expect(manager.getCurrentKeyInfo()?.pubkey).toBe('aaaa');

    expect(manager.reloadCurrentKeyInfo()?.pubkey).toBe('bbbb');
    expect(manager.getCurrentKeyInfo()?.pubkey).toBe('bbbb');
  });

  it('ストレージが読めなくなっても in-memory の鍵情報を落とさない', () => {
    const storage = makeStorage({ nosskey_keyinfo: JSON.stringify(keyInfo('aaaa')) });
    const manager = makeManager(storage);
    expect(manager.getCurrentKeyInfo()?.pubkey).toBe('aaaa');

    // partition・cookie の ITP 失効などで「今は読めない」状態。消去とは区別できない
    // ので、ここで鍵を捨てるとユーザーは署名できなくなる。
    storage.removeItem('nosskey_keyinfo');

    expect(manager.reloadCurrentKeyInfo()?.pubkey).toBe('aaaa');
    expect(manager.hasKeyInfo()).toBe(true);
  });

  it('壊れた JSON でも in-memory の鍵情報を落とさない', () => {
    const storage = makeStorage({ nosskey_keyinfo: JSON.stringify(keyInfo('aaaa')) });
    const manager = makeManager(storage);
    expect(manager.getCurrentKeyInfo()?.pubkey).toBe('aaaa');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.setItem('nosskey_keyinfo', '{ not json');

    expect(manager.reloadCurrentKeyInfo()?.pubkey).toBe('aaaa');
  });

  it('pubkey が変わったときだけ派生鍵キャッシュを破棄する', () => {
    const storage = makeStorage({ nosskey_keyinfo: JSON.stringify(keyInfo('aaaa')) });
    const manager = makeManager(storage);
    manager.getCurrentKeyInfo();
    clearAll.mockClear();

    // 同じアカウントを読み直しただけ: キャッシュは有効なまま残す。
    manager.reloadCurrentKeyInfo();
    expect(clearAll).not.toHaveBeenCalled();

    // アカウントが入れ替わった: 前アカウントの平文秘密鍵を heap に残さない。
    storage.setItem('nosskey_keyinfo', JSON.stringify(keyInfo('bbbb')));
    manager.reloadCurrentKeyInfo();
    expect(clearAll).toHaveBeenCalledTimes(1);
  });

  it('ストレージから読み直すだけで、保存済みの値は消さない', () => {
    const storage = makeStorage({ nosskey_keyinfo: JSON.stringify(keyInfo('aaaa')) });
    const manager = makeManager(storage);

    manager.reloadCurrentKeyInfo();

    expect(storage.getItem('nosskey_keyinfo')).not.toBeNull();
  });

  it('ストレージ無効時はストレージを見に行かない', () => {
    const storage = makeStorage({ nosskey_keyinfo: JSON.stringify(keyInfo('aaaa')) });
    const manager = new NosskeyManager({
      storageOptions: { enabled: false, storage, registryEnabled: false },
    });
    const getItem = vi.spyOn(storage, 'getItem');

    expect(manager.reloadCurrentKeyInfo()).toBeNull();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('未ログイン状態で鍵が現れたら拾う（初回ログイン直後の復帰）', () => {
    const storage = makeStorage();
    const manager = makeManager(storage);
    expect(manager.hasKeyInfo()).toBe(false);

    storage.setItem('nosskey_keyinfo', JSON.stringify(keyInfo('cccc')));

    expect(manager.reloadCurrentKeyInfo()?.pubkey).toBe('cccc');
    expect(manager.hasKeyInfo()).toBe(true);
  });
});
