// @vitest-environment happy-dom
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNosskeyManager, resetNosskeyManager } from '../services/nosskey-manager.service.js';
import { listAccounts } from './accounts.js';
import {
  consentPolicy,
  currentScreen,
  hasLoggedInBefore,
  isLoggedIn,
  loginWith,
  logout,
  publicKey,
  reloadSettings,
  restoreLoginState,
  trustedOrigins,
  wrapBackupPrompt,
} from './app-state.js';
import {
  MAX_CACHE_TTL_SECONDS,
  MIN_CACHE_TTL_SECONDS,
  cacheSecrets,
  cacheTimeout,
} from './secret-cache-settings.js';

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
  consentPolicy.set({ connect: 'ask', signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
  cacheSecrets.set(true);
  cacheTimeout.set(300);
  wrapBackupPrompt.set(null);
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
    // 旧形式（connect キー無し）の保存値は connect: 'ask' に倒れる。
    expect(get(consentPolicy)).toEqual({
      connect: 'ask',
      signEvent: 'always',
      nip44: 'deny',
      nip04: 'ask',
    });
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
    expect(get(consentPolicy)).toEqual({
      connect: 'ask',
      signEvent: 'ask',
      nip44: 'ask',
      nip04: 'ask',
    });
    expect(get(trustedOrigins)).toEqual([]);
    expect(get(cacheSecrets)).toBe(true);
    expect(get(cacheTimeout)).toBe(300);
  });

  it('falls back to the default cache timeout when the stored value is corrupt', () => {
    grantFirstPartyStorage({ nosskey_cache_timeout: 'not-a-number' });
    reloadSettings();
    expect(get(cacheTimeout)).toBe(300);
  });

  it('clamps a tampered oversized cache timeout to the maximum', () => {
    // localStorage は改ざん可能。巨大値が SDK の timeoutMs まで伝播しないこと。
    grantFirstPartyStorage({ nosskey_cache_timeout: '999999999' });
    reloadSettings();
    expect(get(cacheTimeout)).toBe(MAX_CACHE_TTL_SECONDS);
  });

  it('clamps a tampered negative cache timeout to the minimum', () => {
    grantFirstPartyStorage({ nosskey_cache_timeout: '-100' });
    reloadSettings();
    expect(get(cacheTimeout)).toBe(MIN_CACHE_TTL_SECONDS);
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

    consentPolicy.set({ connect: 'ask', signEvent: 'always', nip44: 'ask', nip04: 'ask' });

    // The settings handle and the relay handle are one and the same:
    // manager.getStorageOptions().storage. No second copy is kept.
    expect(getNosskeyManager().getStorageOptions().storage).toBe(firstParty);
    expect(JSON.parse(firstParty.getItem('nosskey_consent_policy') as string)).toEqual({
      connect: 'ask',
      signEvent: 'always',
      nip44: 'ask',
      nip04: 'ask',
    });
  });
});

describe('cross-context sync via storage events', () => {
  it('reloads settings when another context changes a watched key', () => {
    const firstParty = grantFirstPartyStorage();
    firstParty.setItem(
      'nosskey_consent_policy',
      JSON.stringify({ signEvent: 'deny', nip44: 'ask', nip04: 'ask' })
    );
    firstParty.setItem(
      'nosskey_trusted_origins_v2',
      JSON.stringify([{ origin: 'https://parent.example', methods: ['signEvent'] }])
    );

    // 別タブ / iframe からの書き込み相当。実際のブラウザでは書き込んだ当人には
    // storage イベントは発火しないが、テストでは経路検証のため明示的に dispatch する。
    window.dispatchEvent(new StorageEvent('storage', { key: 'nosskey_consent_policy' }));

    expect(get(consentPolicy)).toEqual({
      connect: 'ask',
      signEvent: 'deny',
      nip44: 'ask',
      nip04: 'ask',
    });
    expect(get(trustedOrigins)).toEqual([
      { origin: 'https://parent.example', methods: ['signEvent'] },
    ]);
  });

  it('reloads settings when storage is cleared (event.key === null)', () => {
    const firstParty = grantFirstPartyStorage({
      nosskey_consent_policy: JSON.stringify({ signEvent: 'always', nip44: 'ask', nip04: 'ask' }),
    });
    reloadSettings();
    expect(get(consentPolicy).signEvent).toBe('always');

    firstParty.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));

    expect(get(consentPolicy)).toEqual({
      connect: 'ask',
      signEvent: 'ask',
      nip44: 'ask',
      nip04: 'ask',
    });
  });

  it('ignores storage events for keys it does not own', () => {
    const firstParty = grantFirstPartyStorage();
    reloadSettings();
    consentPolicy.set({ connect: 'ask', signEvent: 'always', nip44: 'ask', nip04: 'ask' });
    // ストレージ側だけ deny に差し替える（in-memory は always のまま）。
    firstParty.setItem(
      'nosskey_consent_policy',
      JSON.stringify({ signEvent: 'deny', nip44: 'ask', nip04: 'ask' })
    );

    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated_key' }));

    // 監視外キーなので reloadSettings は呼ばれず、in-memory は always のまま。
    expect(get(consentPolicy).signEvent).toBe('always');
  });

  it('does not write loaded values back to storage during reloadSettings', () => {
    const firstParty = grantFirstPartyStorage({
      nosskey_consent_policy: JSON.stringify({ signEvent: 'always', nip44: 'ask', nip04: 'ask' }),
    });
    const setItemSpy = vi.spyOn(firstParty, 'setItem');

    reloadSettings();

    // applyingExternalUpdate ガードにより、読み込んだ値を永続化 subscriber が
    // 書き戻さない（冗長な setItem と余計な storage イベントを防ぐ）。
    expect(setItemSpy).not.toHaveBeenCalled();

    // ガードは reloadSettings の外では解除され、通常の変更は永続化される。
    consentPolicy.set({ connect: 'ask', signEvent: 'deny', nip44: 'ask', nip04: 'ask' });
    expect(setItemSpy).toHaveBeenCalledWith(
      'nosskey_consent_policy',
      JSON.stringify({ connect: 'ask', signEvent: 'deny', nip44: 'ask', nip04: 'ask' })
    );
  });
});

describe('loginWith', () => {
  // 新規作成 / nsec インポート / 保存済みアカウント再ログインが共有する活性化処理。
  it('登録簿へ追加し、current 鍵・ストア・履歴フラグを更新して account 画面へ遷移する', async () => {
    const firstParty = grantFirstPartyStorage();
    const keyInfo = {
      credentialId: 'cred-login',
      pubkey: 'pubkey-login-abc',
      salt: '6e6f7374722d70776b',
      username: 'carol',
    };

    await loginWith(keyInfo);

    // current 鍵（nosskey_pwk）へ設定され、公開鍵がストアへ反映される。
    expect(getNosskeyManager().getCurrentKeyInfo()?.pubkey).toBe('pubkey-login-abc');
    expect(get(publicKey)).toBe('pubkey-login-abc');
    expect(get(isLoggedIn)).toBe(true);
    expect(get(currentScreen)).toBe('account');
    expect(hasLoggedInBefore()).toBe(true);

    // 登録簿へ upsert され、同一ハンドルへ永続化される。
    expect(listAccounts().some((a) => a.pubkey === 'pubkey-login-abc')).toBe(true);
    const persisted = JSON.parse(firstParty.getItem('nosskey_accounts') as string);
    expect(persisted.some((a: { pubkey: string }) => a.pubkey === 'pubkey-login-abc')).toBe(true);
  });
});

describe('restoreLoginState', () => {
  // 画面非依存のログイン状態復元。`#/key` などへ直接リロードした場合でも
  // AccountScreen のマウントを待たずにログイン状態を反映できることを保証する。
  it('鍵情報があり未ログインなら公開鍵を復元してログイン状態にする', async () => {
    grantFirstPartyStorage();
    await loginWith({
      credentialId: 'cred-restore',
      pubkey: 'pubkey-restore-abc',
      salt: '6e6f7374722d70776b',
    });
    // リロード相当: SDK manager は鍵を保持したまま、ストアだけ初期状態へ戻す。
    isLoggedIn.set(false);
    publicKey.set(null);

    await restoreLoginState();

    expect(get(isLoggedIn)).toBe(true);
    expect(get(publicKey)).toBe('pubkey-restore-abc');
  });

  it('すでにログイン済みなら何もしない（早期 return）', async () => {
    grantFirstPartyStorage();
    await loginWith({
      credentialId: 'cred-restore',
      pubkey: 'pubkey-restore-abc',
      salt: '6e6f7374722d70776b',
    });
    // 既ログイン状態。公開鍵ストアの値は上書きされず保持される。
    publicKey.set('sentinel-unchanged');

    await restoreLoginState();

    expect(get(isLoggedIn)).toBe(true);
    expect(get(publicKey)).toBe('sentinel-unchanged');
  });

  it('鍵情報が無ければログイン状態をリセットする', async () => {
    grantFirstPartyStorage();
    // 鍵が無いのにログイン状態が残っているケース（ログアウト跨ぎ等）。
    isLoggedIn.set(true);
    publicKey.set('stale-pubkey');

    await restoreLoginState();

    expect(get(isLoggedIn)).toBe(false);
    expect(get(publicKey)).toBe(null);
  });
});

describe('wrapBackupPrompt', () => {
  // wrap モード鍵インポート直後のバックアップ推奨モーダルを制御するストア。
  it('初期値は null（モーダル非表示）', () => {
    expect(get(wrapBackupPrompt)).toBe(null);
  });

  it('logout 時に表示途中のモーダル状態をクリアする', async () => {
    grantFirstPartyStorage();
    await loginWith({
      credentialId: 'cred-wrap',
      pubkey: 'pubkey-wrap-abc',
      salt: '6e6f7374722d70776b2d77726170',
      wrapped: { v: 1, alg: 'nip44-v2', payload: 'AjJ4cGF5bG9hZA==' },
    });
    // インポート直後にモーダルが立っている状態を再現。
    wrapBackupPrompt.set({
      credentialId: 'cred-wrap',
      pubkey: 'pubkey-wrap-abc',
      salt: '6e6f7374722d70776b2d77726170',
      wrapped: { v: 1, alg: 'nip44-v2', payload: 'AjJ4cGF5bG9hZA==' },
    });

    logout();

    // ログアウトでモーダルが AuthScreen 上に残らないこと。
    expect(get(wrapBackupPrompt)).toBe(null);
    expect(get(isLoggedIn)).toBe(false);
    expect(get(currentScreen)).toBe('account');
  });
});
