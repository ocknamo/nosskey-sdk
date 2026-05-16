import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheSecrets,
  cacheTimeout,
  consentPolicy,
  rebindSettingsStorage,
  trustedOrigins,
} from './app-state.js';

/** Map-backed in-memory Storage stand-in for partitioned / first-party buckets. */
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

beforeEach(() => {
  trustedOrigins.set([]);
  consentPolicy.set({ signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
  cacheSecrets.set(true);
  cacheTimeout.set(300);
});

describe('rebindSettingsStorage', () => {
  it('loads consent policy and trusted origins from the rebound storage', () => {
    const firstParty = createFakeStorage({
      nosskey_consent_policy: JSON.stringify({ signEvent: 'always', nip44: 'deny', nip04: 'ask' }),
      nosskey_trusted_origins_v2: JSON.stringify([
        { origin: 'https://parent.example', methods: ['signEvent'] },
      ]),
    });
    rebindSettingsStorage(firstParty);
    expect(get(consentPolicy)).toEqual({ signEvent: 'always', nip44: 'deny', nip04: 'ask' });
    expect(get(trustedOrigins)).toEqual([
      { origin: 'https://parent.example', methods: ['signEvent'] },
    ]);
  });

  it('loads cache settings from the rebound storage', () => {
    const firstParty = createFakeStorage({
      nosskey_cache_secrets: 'false',
      nosskey_cache_timeout: '60',
    });
    rebindSettingsStorage(firstParty);
    expect(get(cacheSecrets)).toBe(false);
    expect(get(cacheTimeout)).toBe(60);
  });

  it('falls back to defaults when the rebound storage is empty', () => {
    rebindSettingsStorage(createFakeStorage());
    expect(get(consentPolicy)).toEqual({ signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
    expect(get(trustedOrigins)).toEqual([]);
    expect(get(cacheSecrets)).toBe(true);
    expect(get(cacheTimeout)).toBe(300);
  });

  it('persists subsequent store updates to the rebound storage', () => {
    const firstParty = createFakeStorage();
    rebindSettingsStorage(firstParty);

    trustedOrigins.set([{ origin: 'https://parent.example', methods: ['nip44'] }]);
    consentPolicy.set({ signEvent: 'always', nip44: 'ask', nip04: 'ask' });

    expect(JSON.parse(firstParty.getItem('nosskey_trusted_origins_v2') as string)).toEqual([
      { origin: 'https://parent.example', methods: ['nip44'] },
    ]);
    expect(JSON.parse(firstParty.getItem('nosskey_consent_policy') as string)).toEqual({
      signEvent: 'always',
      nip44: 'ask',
      nip04: 'ask',
    });
  });

  it('does not write to the previous storage after rebinding', () => {
    const partitioned = createFakeStorage();
    const firstParty = createFakeStorage();
    rebindSettingsStorage(partitioned);
    rebindSettingsStorage(firstParty);

    trustedOrigins.set([{ origin: 'https://parent.example', methods: ['signEvent'] }]);

    // The update lands only in the currently-bound (first-party) storage.
    expect(JSON.parse(firstParty.getItem('nosskey_trusted_origins_v2') as string)).toEqual([
      { origin: 'https://parent.example', methods: ['signEvent'] },
    ]);
    // The previously-bound storage keeps whatever it held at rebind time ([]),
    // never the post-rebind update.
    expect(partitioned.getItem('nosskey_trusted_origins_v2')).toBe('[]');
  });
});
