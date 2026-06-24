import type { ConsentRequest } from 'nosskey-iframe';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveConsent,
  onConsent,
  onConsentWithFreshSettings,
  pendingConsent,
  rejectConsent,
} from './iframe-mode.js';
import { getNosskeyManager, resetNosskeyManager } from './services/nosskey-manager.service.js';
import { consentPolicy, denyCounts, resetDenyCounts, trustedOrigins } from './store/app-state.js';

const origin = 'https://parent.example';

const signRequest: ConsentRequest = {
  origin,
  method: 'signEvent',
  event: {
    kind: 1,
    content: 'hello',
    tags: [],
    created_at: 0,
    pubkey: '',
    id: '',
    sig: '',
  },
};

const nip04Request: ConsentRequest = {
  origin,
  method: 'nip04_decrypt',
  pubkey: 'a'.repeat(64),
};

const nip04EncryptRequest: ConsentRequest = {
  origin,
  method: 'nip04_encrypt',
  pubkey: 'a'.repeat(64),
  plaintext: 'hi',
};

const getPublicKeyRequest: ConsentRequest = {
  origin,
  method: 'getPublicKey',
};

const getRelaysRequest: ConsentRequest = {
  origin,
  method: 'getRelays',
};

beforeEach(() => {
  // 各テストを独立させる: SDK マネージャのハンドル / ストレージ残留を持ち越さない。
  resetNosskeyManager();
  localStorage.clear();
  sessionStorage.clear();
  trustedOrigins.set([]);
  consentPolicy.set({ connect: 'ask', signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
  resetDenyCounts();
  pendingConsent.set(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('onConsent', () => {
  it('resolves true immediately when policy is always (no dialog)', async () => {
    consentPolicy.set({ connect: 'ask', signEvent: 'always', nip44: 'ask', nip04: 'ask' });
    const result = await onConsent(signRequest);
    expect(result).toBe(true);
    expect(get(pendingConsent)).toBeNull();
  });

  it('resolves false immediately when policy is deny, warns, and increments counter', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consentPolicy.set({ connect: 'ask', signEvent: 'ask', nip44: 'ask', nip04: 'deny' });
    const result = await onConsent(nip04Request);
    expect(result).toBe(false);
    expect(get(pendingConsent)).toBeNull();
    expect(get(denyCounts).nip04).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('resolves true immediately when origin is trusted for the method (encrypt)', async () => {
    trustedOrigins.set([{ origin, methods: ['nip04'] }]);
    const result = await onConsent(nip04EncryptRequest);
    expect(result).toBe(true);
  });

  it('always shows the dialog for decrypt even when the origin is trusted (M-1)', async () => {
    // 復号はオラクルになり得るため「常に許可」の対象外。信頼済みでもダイアログを出す。
    trustedOrigins.set([{ origin, methods: ['nip04'] }]);
    const promise = onConsent(nip04Request);
    expect(get(pendingConsent)).not.toBeNull();
    rejectConsent();
    expect(await promise).toBe(false);
  });

  it('always shows the dialog for decrypt even when the bucket policy is always (M-1)', async () => {
    consentPolicy.set({ connect: 'ask', signEvent: 'ask', nip44: 'ask', nip04: 'always' });
    const promise = onConsent(nip04Request);
    expect(get(pendingConsent)).not.toBeNull();
    rejectConsent();
    expect(await promise).toBe(false);
  });

  it('does not remember a decrypt method even if trustOrigin is set (M-1 defense-in-depth)', async () => {
    const promise = onConsent(nip04Request);
    approveConsent({ trustOrigin: true });
    expect(await promise).toBe(true);
    // 復号は信頼リストに載せない（載せても evaluateConsent がサイレント承認しない）。
    expect(get(trustedOrigins)).toEqual([]);
  });

  it('falls through to ask when origin is trusted for a different method', async () => {
    trustedOrigins.set([{ origin, methods: ['signEvent'] }]);
    const promise = onConsent(nip04EncryptRequest);
    expect(get(pendingConsent)).not.toBeNull();
    rejectConsent();
    expect(await promise).toBe(false);
  });

  it('approveConsent without trustOrigin does not add origin to trusted list', async () => {
    const promise = onConsent(signRequest);
    expect(get(pendingConsent)).not.toBeNull();
    approveConsent();
    expect(await promise).toBe(true);
    expect(get(trustedOrigins)).toEqual([]);
  });

  it('approveConsent with trustOrigin adds origin × method to trusted list', async () => {
    const promise = onConsent(signRequest);
    approveConsent({ trustOrigin: true });
    expect(await promise).toBe(true);
    expect(get(trustedOrigins)).toEqual([{ origin, methods: ['signEvent'] }]);
  });

  it('approveConsent with trustOrigin appends a new method to an existing entry', async () => {
    trustedOrigins.set([{ origin, methods: ['signEvent'] }]);
    const promise = onConsent(nip04EncryptRequest);
    approveConsent({ trustOrigin: true });
    expect(await promise).toBe(true);
    expect(get(trustedOrigins)).toEqual([{ origin, methods: ['signEvent', 'nip04'] }]);
  });

  it('approveConsent with trustOrigin is idempotent for a method already trusted', async () => {
    trustedOrigins.set([{ origin, methods: ['nip04'] }]);
    // 既に trust 済みなら policy=ask の経路に乗らないが、念のためポリシーを上書きして
    // ダイアログ経路に流して同 method を再度許可した時に重複しないことを確認する。
    consentPolicy.set({ connect: 'ask', signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
    trustedOrigins.set([{ origin, methods: [] }]); // この origin はリストに居るが method 空
    const promise = onConsent(nip04EncryptRequest);
    approveConsent({ trustOrigin: true });
    await promise;
    expect(get(trustedOrigins)).toEqual([{ origin, methods: ['nip04'] }]);
  });

  it('rejectConsent does not add to trusted list even if checkbox was checked', async () => {
    // rejectConsent は ApproveOptions を渡さない。Reject 経路で trust が漏れない回帰防止。
    const promise = onConsent(signRequest);
    rejectConsent();
    expect(await promise).toBe(false);
    expect(get(trustedOrigins)).toEqual([]);
  });

  it('deny policy beats trusted origin', async () => {
    trustedOrigins.set([{ origin, methods: ['signEvent'] }]);
    consentPolicy.set({ connect: 'ask', signEvent: 'deny', nip44: 'ask', nip04: 'ask' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await onConsent(signRequest);
    expect(result).toBe(false);
    expect(get(denyCounts).signEvent).toBe(1);
  });

  it('asks for getPublicKey by default (no silent pairing)', async () => {
    const promise = onConsent(getPublicKeyRequest);
    expect(get(pendingConsent)).not.toBeNull();
    rejectConsent();
    expect(await promise).toBe(false);
  });

  it('approveConsent with trustOrigin records the connect pairing for the origin', async () => {
    const promise = onConsent(getPublicKeyRequest);
    approveConsent({ trustOrigin: true });
    expect(await promise).toBe(true);
    expect(get(trustedOrigins)).toEqual([{ origin, methods: ['connect'] }]);
  });

  it('a connect pairing approves subsequent getRelays without a dialog (one approval covers both)', async () => {
    const promise = onConsent(getPublicKeyRequest);
    approveConsent({ trustOrigin: true });
    expect(await promise).toBe(true);

    const result = await onConsent(getRelaysRequest);
    expect(result).toBe(true);
    expect(get(pendingConsent)).toBeNull();
  });

  it('connect deny policy auto-rejects getPublicKey and increments the counter', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consentPolicy.set({ connect: 'deny', signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
    const result = await onConsent(getPublicKeyRequest);
    expect(result).toBe(false);
    expect(get(denyCounts).connect).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('onConsentWithFreshSettings', () => {
  it('re-reads persisted settings so a settings-page deny overrides a stale always store', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // iframe の in-memory ストアは古い「always 許可」のまま。
    consentPolicy.set({ connect: 'ask', signEvent: 'always', nip44: 'ask', nip04: 'ask' });
    // 設定画面タブが localStorage を deny に書き換えたことを模す。永続化 subscriber に
    // 上書きされないよう、ストア set より後にストレージへ直接書き込む。
    localStorage.setItem(
      'nosskey_consent_policy',
      JSON.stringify({ signEvent: 'deny', nip44: 'ask', nip04: 'ask' })
    );

    const result = await onConsentWithFreshSettings(signRequest);

    expect(result).toBe(false);
    expect(get(denyCounts).signEvent).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('re-reads persisted settings so a revoked trusted origin falls back to the dialog', async () => {
    // 古い「常に許可」が in-memory に残っている状態。
    trustedOrigins.set([{ origin, methods: ['signEvent'] }]);
    consentPolicy.set({ connect: 'ask', signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
    // 設定画面タブが信頼リストを空にした（信頼解除）ことを模す。
    localStorage.setItem('nosskey_trusted_origins_v2', JSON.stringify([]));

    const promise = onConsentWithFreshSettings(signRequest);
    // 信頼解除が読み直されたので自動承認されず、同意ダイアログ待ちになる。
    expect(get(pendingConsent)).not.toBeNull();
    rejectConsent();
    expect(await promise).toBe(false);
  });

  it('reads through the granted SDK storage handle (SAA first-party path)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // in-memory ストアは古い「always 許可」のまま（localStorage に書かれる）。
    consentPolicy.set({ connect: 'ask', signEvent: 'always', nip44: 'ask', nip04: 'ask' });
    // SAA グラント後の first-party ストレージハンドルを sessionStorage で代用し、
    // 設定画面が deny を書き込んだ状態を模す。reloadSettings は
    // resolveSettingsStorage() 経由でこのハンドルを優先して読む。
    sessionStorage.setItem(
      'nosskey_consent_policy',
      JSON.stringify({ signEvent: 'deny', nip44: 'ask', nip04: 'ask' })
    );
    getNosskeyManager().setStorageOptions({ storage: sessionStorage });

    const result = await onConsentWithFreshSettings(signRequest);

    expect(result).toBe(false);
    expect(get(denyCounts).signEvent).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
  });
});
