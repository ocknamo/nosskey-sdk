// @vitest-environment happy-dom
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { getNosskeyManager, resetNosskeyManager } from '../services/nosskey-manager.service.js';
import {
  cacheSecrets,
  cacheTimeout,
  consentPolicy,
  reloadSettings,
  trustedOrigins,
} from './app-state.js';

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
 * Point the shared SDK manager at a fresh first-party storage handle, the
 * way IframeHostScreen does after a Storage Access API grant. Settings then
 * resolve their storage through the same manager handle the relay sync uses.
 */
function grantFirstPartyStorage(seed: Record<string, string> = {}): Storage {
  const firstParty = createFakeStorage(seed);
  getNosskeyManager().setStorageOptions({ storage: firstParty });
  return firstParty;
}

beforeEach(() => {
  resetNosskeyManager();
  trustedOrigins.set([]);
  consentPolicy.set({ signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
  cacheSecrets.set(true);
  cacheTimeout.set(300);
});

describe('reloadSettings', () => {
  it('reads consent policy and trusted origins from the granted storage handle', () => {
    grantFirstPartyStorage({
      nosskey_consent_policy: JSON.stringify({ signEvent: 'always', nip44: 'deny', nip04: 'ask' }),
      nosskey_trusted_origins_v2: JSON.stringify([
        { origin: 'https://parent.example', methods: ['signEvent'] },
      ]),
    });
    reloadSettings();
    expect(get(consentPolicy)).toEqual({ signEvent: 'always', nip44: 'deny', nip04: 'ask' });
    expect(get(trustedOrigins)).toEqual([
      { origin: 'https://parent.example', methods: ['signEvent'] },
    ]);
  });

  it('reads cache settings from the granted storage handle', () => {
    grantFirstPartyStorage({ nosskey_cache_secrets: 'false', nosskey_cache_timeout: '60' });
    reloadSettings();
    expect(get(cacheSecrets)).toBe(false);
    expect(get(cacheTimeout)).toBe(60);
  });

  it('falls back to defaults when the granted storage is empty', () => {
    grantFirstPartyStorage();
    reloadSettings();
    expect(get(consentPolicy)).toEqual({ signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
    expect(get(trustedOrigins)).toEqual([]);
    expect(get(cacheSecrets)).toBe(true);
    expect(get(cacheTimeout)).toBe(300);
  });

  it('falls back to the default cache timeout when the stored value is corrupt', () => {
    grantFirstPartyStorage({ nosskey_cache_timeout: 'not-a-number' });
    reloadSettings();
    expect(get(cacheTimeout)).toBe(300);
  });
});

describe('settings persistence after a storage grant', () => {
  it('persists a trustedOrigins.update() to the granted storage handle', () => {
    // Mirrors iframe-mode.ts rememberOriginIfRequested: the consent dialog
    // "always allow" path appends via update(), not set().
    const firstParty = grantFirstPartyStorage();
    reloadSettings();

    trustedOrigins.update((list) => [
      ...list,
      { origin: 'https://parent.example', methods: ['signEvent'] },
    ]);

    expect(JSON.parse(firstParty.getItem('nosskey_trusted_origins_v2') as string)).toEqual([
      { origin: 'https://parent.example', methods: ['signEvent'] },
    ]);
  });

  it('writes through the same handle the SDK manager exposes for relay sync', () => {
    const firstParty = grantFirstPartyStorage();
    reloadSettings();

    consentPolicy.set({ signEvent: 'always', nip44: 'ask', nip04: 'ask' });

    // The settings handle and the relay handle are one and the same:
    // manager.getStorageOptions().storage. No second copy is kept.
    expect(getNosskeyManager().getStorageOptions().storage).toBe(firstParty);
    expect(JSON.parse(firstParty.getItem('nosskey_consent_policy') as string)).toEqual({
      signEvent: 'always',
      nip44: 'ask',
      nip04: 'ask',
    });
  });
});
