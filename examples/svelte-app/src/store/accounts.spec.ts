// @vitest-environment happy-dom
import type { NostrKeyInfo } from 'nosskey-sdk';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STANDARD_SALT = '6e6f7374722d70776b';
const LEGACY_SALT = '6e6f7374722d6b6579';
const WRAP_SALT = '6e6f7374722d70776b2d77726170';

/** Map-backed in-memory Storage stand-in for a first-party storage handle. */
function createFakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, String(value));
    },
  };
}

/**
 * Load a fresh copy of the accounts module (its `initialized` module state must
 * not leak between tests) and a matching service module, then point the shared
 * SDK manager at `storage`. The accounts module is now a thin reactive layer
 * over the SDK registry, so the SDK manager owns the persistence.
 */
async function freshModules(storage: Storage) {
  vi.resetModules();
  const svc = await import('../services/nosskey-manager.service.js');
  const accounts = await import('./accounts.js');
  svc.resetNosskeyManager();
  svc.getNosskeyManager().setStorageOptions({ storage });
  return { svc, accounts };
}

const baseKey: NostrKeyInfo = {
  credentialId: 'cred-1',
  pubkey: 'pub-1',
  salt: STANDARD_SALT,
};

beforeEach(() => {
  vi.resetModules();
});

describe('listAccounts / removeAccount (SDK 委譲)', () => {
  it('SDK 登録簿の内容を反映し、store も同期する', async () => {
    const storage = createFakeStorage();
    const { svc, accounts } = await freshModules(storage);

    svc.getNosskeyManager().setCurrentKeyInfo(baseKey);
    accounts.refreshAccounts();

    expect(accounts.listAccounts()).toEqual([baseKey]);
    expect(get(accounts.accounts)).toEqual([baseKey]);
    // SDK が別キー nosskey_accounts へ永続化している
    expect(JSON.parse(storage.getItem('nosskey_accounts') as string)).toEqual([baseKey]);
  });

  it('同一 pubkey でも credentialId が異なれば別エントリとして保持する', async () => {
    const storage = createFakeStorage();
    const { svc, accounts } = await freshModules(storage);

    svc.getNosskeyManager().setCurrentKeyInfo(baseKey);
    svc.getNosskeyManager().setCurrentKeyInfo({ ...baseKey, credentialId: 'cred-2' });
    accounts.refreshAccounts();

    expect(accounts.listAccounts()).toHaveLength(2);
  });

  it('removeAccount は pubkey + credentialId 一致のみ削除し store を同期する', async () => {
    const storage = createFakeStorage();
    const { svc, accounts } = await freshModules(storage);

    svc.getNosskeyManager().setCurrentKeyInfo(baseKey);
    svc
      .getNosskeyManager()
      .setCurrentKeyInfo({ ...baseKey, pubkey: 'pub-2', credentialId: 'cred-2' });
    accounts.refreshAccounts();

    accounts.removeAccount('pub-1', 'cred-1');

    expect(accounts.listAccounts().map((a) => a.pubkey)).toEqual(['pub-2']);
    expect(get(accounts.accounts).map((a) => a.pubkey)).toEqual(['pub-2']);
    expect(JSON.parse(storage.getItem('nosskey_accounts') as string)).toHaveLength(1);
  });

  it('wrap モードの salt と wrapped payload を維持する', async () => {
    const storage = createFakeStorage();
    const { svc, accounts } = await freshModules(storage);

    const wrapKey: NostrKeyInfo = {
      credentialId: 'cred-w',
      pubkey: 'pub-w',
      salt: WRAP_SALT,
      wrapped: { v: 1, alg: 'nip44-v2', payload: 'cipher' },
    };
    svc.getNosskeyManager().setCurrentKeyInfo(wrapKey);
    accounts.refreshAccounts();

    expect(accounts.listAccounts()[0]).toEqual(wrapKey);
  });
});

describe('initAccounts', () => {
  it('SDK 登録簿を読み込み、壊れた要素は除外する', async () => {
    const storage = createFakeStorage({
      nosskey_accounts: JSON.stringify([
        baseKey,
        { pubkey: 'no-cred' }, // missing credentialId/salt → dropped
        { credentialId: 'c', pubkey: 'bad-wrap', salt: WRAP_SALT, wrapped: { v: 2 } }, // bad wrapped → dropped
      ]),
    });
    const { accounts } = await freshModules(storage);

    accounts.initAccounts();

    expect(accounts.listAccounts()).toEqual([baseKey]);
    expect(get(accounts.accounts)).toEqual([baseKey]);
  });

  it('単一スロットの current 鍵を空の登録簿へ移行する（SDK の lazy 移行）', async () => {
    const stored: NostrKeyInfo = { credentialId: 'cred-m', pubkey: 'pub-m', salt: LEGACY_SALT };
    const storage = createFakeStorage({ nosskey_pwk: JSON.stringify(stored) });
    const { accounts } = await freshModules(storage);

    accounts.initAccounts();

    const list = accounts.listAccounts();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ pubkey: 'pub-m', salt: STANDARD_SALT });
    // migration is persisted to the registry key
    expect(JSON.parse(storage.getItem('nosskey_accounts') as string)).toHaveLength(1);
  });

  it('登録簿が空配列（削除済み）なら current が残っていても蘇生しない', async () => {
    const stored: NostrKeyInfo = { credentialId: 'cred-m', pubkey: 'pub-m', salt: STANDARD_SALT };
    const storage = createFakeStorage({
      nosskey_pwk: JSON.stringify(stored),
      nosskey_accounts: JSON.stringify([]),
    });
    const { accounts } = await freshModules(storage);

    accounts.initAccounts();

    expect(accounts.listAccounts()).toEqual([]);
  });

  it('ストレージが壊れているときは空の登録簿を返す', async () => {
    const storage = createFakeStorage({ nosskey_accounts: 'not-json' });
    const { accounts } = await freshModules(storage);

    accounts.initAccounts();

    expect(accounts.listAccounts()).toEqual([]);
  });

  it('初期化は 1 回だけ行われる', async () => {
    const storage = createFakeStorage({ nosskey_accounts: JSON.stringify([baseKey]) });
    const { svc, accounts } = await freshModules(storage);

    accounts.initAccounts();
    // 2 回目以降は no-op（store の再同期はしないが、listAccounts は SDK を直接読む）
    svc
      .getNosskeyManager()
      .setCurrentKeyInfo({ ...baseKey, pubkey: 'pub-2', credentialId: 'cred-2' });
    accounts.initAccounts();

    // listAccounts は常に SDK の最新を返す
    expect(accounts.listAccounts()).toHaveLength(2);
  });
});
