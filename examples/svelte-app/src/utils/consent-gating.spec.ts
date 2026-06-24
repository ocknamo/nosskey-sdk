import { describe, expect, it } from 'vitest';
import type { ConsentPolicy, TrustedOriginEntry } from '../store/app-state.js';
import { evaluateConsent, policyKeyFor } from './consent-gating.js';

const askPolicy: ConsentPolicy = {
  connect: 'ask',
  signEvent: 'ask',
  nip44: 'ask',
  nip04: 'ask',
};

describe('policyKeyFor', () => {
  it.each([
    ['getPublicKey', 'connect'],
    ['getRelays', 'connect'],
    ['signEvent', 'signEvent'],
    ['nip44_encrypt', 'nip44'],
    ['nip44_decrypt', 'nip44'],
    ['nip04_encrypt', 'nip04'],
    ['nip04_decrypt', 'nip04'],
  ] as const)('maps %s -> %s', (method, expected) => {
    expect(policyKeyFor(method)).toBe(expected);
  });
});

describe('evaluateConsent', () => {
  const origin = 'https://parent.example';

  it('returns ask when policy is ask and origin is not trusted', () => {
    expect(
      evaluateConsent({ origin, method: 'signEvent' }, { trustedOrigins: [], policy: askPolicy })
    ).toEqual({ decision: 'ask' });
  });

  it('returns reject when policy is deny, even for trusted origin', () => {
    const policy: ConsentPolicy = { ...askPolicy, signEvent: 'deny' };
    const trusted: TrustedOriginEntry[] = [{ origin, methods: ['signEvent'] }];
    expect(
      evaluateConsent({ origin, method: 'signEvent' }, { trustedOrigins: trusted, policy })
    ).toEqual({ decision: 'reject', reason: 'policy-deny' });
  });

  it('returns approve when policy is always', () => {
    const policy: ConsentPolicy = { ...askPolicy, nip44: 'always' };
    expect(
      evaluateConsent({ origin, method: 'nip44_encrypt' }, { trustedOrigins: [], policy })
    ).toEqual({ decision: 'approve', reason: 'policy-always' });
  });

  it('returns approve when origin is trusted for this method (encrypt)', () => {
    const trusted: TrustedOriginEntry[] = [{ origin, methods: ['nip04'] }];
    expect(
      evaluateConsent(
        { origin, method: 'nip04_encrypt' },
        { trustedOrigins: trusted, policy: askPolicy }
      )
    ).toEqual({ decision: 'approve', reason: 'trusted-origin' });
  });

  it('returns ask when origin is trusted for a different method (no implicit elevation)', () => {
    // signEvent のみ信頼している origin が、nip04_decrypt を要求してきたケース。
    // メソッド境界を越えて自動承認しないことを保証する。
    const trusted: TrustedOriginEntry[] = [{ origin, methods: ['signEvent'] }];
    expect(
      evaluateConsent(
        { origin, method: 'nip04_decrypt' },
        { trustedOrigins: trusted, policy: askPolicy }
      )
    ).toEqual({ decision: 'ask' });
  });

  it('approves nip44 encrypt under an "always" bucket but still asks for decrypt (M-1)', () => {
    const policy: ConsentPolicy = { ...askPolicy, nip44: 'always' };
    expect(
      evaluateConsent({ origin, method: 'nip44_encrypt' }, { trustedOrigins: [], policy })
    ).toEqual({ decision: 'approve', reason: 'policy-always' });
    // Decrypt is a disclosure oracle and must never be silenced by "always".
    expect(
      evaluateConsent({ origin, method: 'nip44_decrypt' }, { trustedOrigins: [], policy })
    ).toEqual({ decision: 'ask' });
  });

  it('always asks for decrypt even when the origin is trusted for that bucket (M-1)', () => {
    const trusted: TrustedOriginEntry[] = [{ origin, methods: ['nip44'] }];
    for (const method of ['nip44_decrypt', 'nip04_decrypt'] as const) {
      const t: TrustedOriginEntry[] = [{ origin, methods: [policyKeyFor(method)] }];
      expect(evaluateConsent({ origin, method }, { trustedOrigins: t, policy: askPolicy })).toEqual(
        {
          decision: 'ask',
        }
      );
    }
    // Sanity: the same trusted entry DOES silence the encrypt counterpart.
    expect(
      evaluateConsent(
        { origin, method: 'nip44_encrypt' },
        { trustedOrigins: trusted, policy: askPolicy }
      )
    ).toEqual({ decision: 'approve', reason: 'trusted-origin' });
  });

  it('still rejects decrypt when the bucket policy is deny (deny wins over the M-1 ask)', () => {
    const policy: ConsentPolicy = { ...askPolicy, nip44: 'deny' };
    expect(
      evaluateConsent({ origin, method: 'nip44_decrypt' }, { trustedOrigins: [], policy })
    ).toEqual({ decision: 'reject', reason: 'policy-deny' });
  });

  it('treats nip04 encrypt and decrypt as the same policy bucket', () => {
    const policy: ConsentPolicy = { ...askPolicy, nip04: 'deny' };
    const trusted: TrustedOriginEntry[] = [{ origin, methods: ['nip04'] }];
    for (const method of ['nip04_encrypt', 'nip04_decrypt'] as const) {
      expect(evaluateConsent({ origin, method }, { trustedOrigins: trusted, policy })).toEqual({
        decision: 'reject',
        reason: 'policy-deny',
      });
    }
  });

  it('treats getPublicKey and getRelays as the same connect bucket (one pairing covers both)', () => {
    const trusted: TrustedOriginEntry[] = [{ origin, methods: ['connect'] }];
    for (const method of ['getPublicKey', 'getRelays'] as const) {
      expect(
        evaluateConsent({ origin, method }, { trustedOrigins: trusted, policy: askPolicy })
      ).toEqual({ decision: 'approve', reason: 'trusted-origin' });
    }
  });

  it('asks for connect when origin is trusted only for signEvent (no implicit pairing)', () => {
    const trusted: TrustedOriginEntry[] = [{ origin, methods: ['signEvent'] }];
    expect(
      evaluateConsent(
        { origin, method: 'getPublicKey' },
        { trustedOrigins: trusted, policy: askPolicy }
      )
    ).toEqual({ decision: 'ask' });
  });

  it('rejects connect requests when the connect policy is deny', () => {
    const policy: ConsentPolicy = { ...askPolicy, connect: 'deny' };
    const trusted: TrustedOriginEntry[] = [{ origin, methods: ['connect'] }];
    expect(
      evaluateConsent({ origin, method: 'getPublicKey' }, { trustedOrigins: trusted, policy })
    ).toEqual({ decision: 'reject', reason: 'policy-deny' });
  });
});
