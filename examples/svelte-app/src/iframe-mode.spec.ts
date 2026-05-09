import type { ConsentRequest } from 'nosskey-iframe';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { approveConsent, onConsent, pendingConsent, rejectConsent } from './iframe-mode.js';
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

beforeEach(() => {
  trustedOrigins.set([]);
  consentPolicy.set({ signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
  resetDenyCounts();
  pendingConsent.set(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('onConsent', () => {
  it('resolves true immediately when policy is always (no dialog)', async () => {
    consentPolicy.set({ signEvent: 'always', nip44: 'ask', nip04: 'ask' });
    const result = await onConsent(signRequest);
    expect(result).toBe(true);
    expect(get(pendingConsent)).toBeNull();
  });

  it('resolves false immediately when policy is deny, warns, and increments counter', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consentPolicy.set({ signEvent: 'ask', nip44: 'ask', nip04: 'deny' });
    const result = await onConsent(nip04Request);
    expect(result).toBe(false);
    expect(get(pendingConsent)).toBeNull();
    expect(get(denyCounts).nip04).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('resolves true immediately when origin is trusted for the method', async () => {
    trustedOrigins.set([{ origin, methods: ['nip04'] }]);
    const result = await onConsent(nip04Request);
    expect(result).toBe(true);
  });

  it('falls through to ask when origin is trusted for a different method', async () => {
    trustedOrigins.set([{ origin, methods: ['signEvent'] }]);
    const promise = onConsent(nip04Request);
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
    const promise = onConsent(nip04Request);
    approveConsent({ trustOrigin: true });
    expect(await promise).toBe(true);
    expect(get(trustedOrigins)).toEqual([{ origin, methods: ['signEvent', 'nip04'] }]);
  });

  it('approveConsent with trustOrigin is idempotent for a method already trusted', async () => {
    trustedOrigins.set([{ origin, methods: ['nip04'] }]);
    // 既に trust 済みなら policy=ask の経路に乗らないが、念のためポリシーを上書きして
    // ダイアログ経路に流して同 method を再度許可した時に重複しないことを確認する。
    consentPolicy.set({ signEvent: 'ask', nip44: 'ask', nip04: 'ask' });
    trustedOrigins.set([{ origin, methods: [] }]); // この origin はリストに居るが method 空
    const promise = onConsent(nip04Request);
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
    consentPolicy.set({ signEvent: 'deny', nip44: 'ask', nip04: 'ask' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await onConsent(signRequest);
    expect(result).toBe(false);
    expect(get(denyCounts).signEvent).toBe(1);
  });
});
