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
 * Load a fresh copy of the accounts module (its `current` / `initialized`
 * module state must not leak between tests) and a matching service module,
 * then point the shared SDK manager at `storage` so both modules resolve to
 * the same first-party handle (the way IframeHostScreen does after a grant).
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

describe('upsertAccount / listAccounts / removeAccount', () => {
  it('adds an account, reflects it in the store, and persists it', async () => {
    const storage = createFakeStorage();
    const { accounts } = await freshModules(storage);

    accounts.upsertAccount(baseKey);

    expect(accounts.listAccounts()).toEqual([baseKey]);
    expect(get(accounts.accounts)).toEqual([baseKey]);
    expect(JSON.parse(storage.getItem('nosskey_accounts') as string)).toEqual([baseKey]);
  });

  it('dedupes by pubkey, replacing the existing entry', async () => {
    const storage = createFakeStorage();
    const { accounts } = await freshModules(storage);

    accounts.upsertAccount(baseKey);
    accounts.upsertAccount({ ...baseKey, credentialId: 'cred-2', username: 'renamed' });

    const list = accounts.listAccounts();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ pubkey: 'pub-1', credentialId: 'cred-2', username: 'renamed' });
  });

  it('keeps an existing username when a later upsert omits it', async () => {
    const storage = createFakeStorage();
    const { accounts } = await freshModules(storage);

    accounts.upsertAccount({ ...baseKey, username: 'alice' });
    // パスキーピッカー経由の login() 相当（username なしの再登録）
    accounts.upsertAccount({ ...baseKey, credentialId: 'cred-2' });

    const list = accounts.listAccounts();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ credentialId: 'cred-2', username: 'alice' });
  });

  it('overwrites the username when the later upsert provides a new one', async () => {
    const storage = createFakeStorage();
    const { accounts } = await freshModules(storage);

    accounts.upsertAccount({ ...baseKey, username: 'alice' });
    accounts.upsertAccount({ ...baseKey, username: 'bob' });

    expect(accounts.listAccounts()[0].username).toBe('bob');
  });

  it('keeps distinct pubkeys as separate accounts', async () => {
    const storage = createFakeStorage();
    const { accounts } = await freshModules(storage);

    accounts.upsertAccount(baseKey);
    accounts.upsertAccount({ ...baseKey, pubkey: 'pub-2' });

    expect(accounts.listAccounts().map((a) => a.pubkey)).toEqual(['pub-1', 'pub-2']);
  });

  it('removes an account by pubkey', async () => {
    const storage = createFakeStorage();
    const { accounts } = await freshModules(storage);

    accounts.upsertAccount(baseKey);
    accounts.upsertAccount({ ...baseKey, pubkey: 'pub-2' });
    accounts.removeAccount('pub-1');

    expect(accounts.listAccounts().map((a) => a.pubkey)).toEqual(['pub-2']);
    expect(JSON.parse(storage.getItem('nosskey_accounts') as string)).toHaveLength(1);
  });
});

describe('salt normalization on entry', () => {
  it('rewrites legacy/undefined salt to the standard salt', async () => {
    const storage = createFakeStorage();
    const { accounts } = await freshModules(storage);

    accounts.upsertAccount({ ...baseKey, salt: LEGACY_SALT });

    expect(accounts.listAccounts()[0].salt).toBe(STANDARD_SALT);
  });

  it('preserves the wrap-mode salt and wrapped payload', async () => {
    const storage = createFakeStorage();
    const { accounts } = await freshModules(storage);

    const wrapKey: NostrKeyInfo = {
      credentialId: 'cred-w',
      pubkey: 'pub-w',
      salt: WRAP_SALT,
      wrapped: { v: 1, alg: 'nip44-v2', payload: 'cipher' },
    };
    accounts.upsertAccount(wrapKey);

    expect(accounts.listAccounts()[0]).toEqual(wrapKey);
  });
});

describe('initAccounts', () => {
  it('loads an existing registry and drops malformed entries', async () => {
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
  });

  it('migrates the SDK current key into an empty registry', async () => {
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

  it('returns an empty registry when storage is corrupted', async () => {
    const storage = createFakeStorage({ nosskey_accounts: 'not-json' });
    const { accounts } = await freshModules(storage);

    accounts.initAccounts();

    expect(accounts.listAccounts()).toEqual([]);
  });

  it('only initializes once', async () => {
    const storage = createFakeStorage({ nosskey_accounts: JSON.stringify([baseKey]) });
    const { accounts } = await freshModules(storage);

    accounts.initAccounts();
    // a later upsert then a second init must not clobber in-memory state
    accounts.upsertAccount({ ...baseKey, pubkey: 'pub-2' });
    accounts.initAccounts();

    expect(accounts.listAccounts()).toHaveLength(2);
  });
});
