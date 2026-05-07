import { describe, expect, it } from 'vitest';
import type { ConsentPolicy } from '../store/app-state.js';
import { evaluateConsent, policyKeyFor } from './consent-gating.js';

const askPolicy: ConsentPolicy = {
  signEvent: 'ask',
  nip44: 'ask',
  nip04: 'ask',
};

describe('policyKeyFor', () => {
  it.each([
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
    expect(
      evaluateConsent({ origin, method: 'signEvent' }, { trustedOrigins: [origin], policy })
    ).toEqual({ decision: 'reject', reason: 'policy-deny' });
  });

  it('returns approve when policy is always', () => {
    const policy: ConsentPolicy = { ...askPolicy, nip44: 'always' };
    expect(
      evaluateConsent({ origin, method: 'nip44_encrypt' }, { trustedOrigins: [], policy })
    ).toEqual({ decision: 'approve', reason: 'policy-always' });
  });

  it('returns approve when origin is trusted and policy is ask', () => {
    expect(
      evaluateConsent(
        { origin, method: 'nip04_decrypt' },
        { trustedOrigins: [origin], policy: askPolicy }
      )
    ).toEqual({ decision: 'approve', reason: 'trusted-origin' });
  });

  it('treats nip44 encrypt and decrypt as the same policy bucket', () => {
    const policy: ConsentPolicy = { ...askPolicy, nip44: 'always' };
    for (const method of ['nip44_encrypt', 'nip44_decrypt'] as const) {
      expect(evaluateConsent({ origin, method }, { trustedOrigins: [], policy })).toEqual({
        decision: 'approve',
        reason: 'policy-always',
      });
    }
  });

  it('treats nip04 encrypt and decrypt as the same policy bucket', () => {
    const policy: ConsentPolicy = { ...askPolicy, nip04: 'deny' };
    for (const method of ['nip04_encrypt', 'nip04_decrypt'] as const) {
      expect(evaluateConsent({ origin, method }, { trustedOrigins: [origin], policy })).toEqual({
        decision: 'reject',
        reason: 'policy-deny',
      });
    }
  });
});
