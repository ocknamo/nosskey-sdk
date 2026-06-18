import { describe, expect, it } from 'vitest';
import { formatAuthError, isPrfUnsupportedError } from './auth-error.js';

const PRF_UNSUPPORTED = 'try another passkey';

describe('isPrfUnsupportedError', () => {
  it('detects "PRF secret not available"', () => {
    expect(isPrfUnsupportedError(new Error('PRF secret not available'))).toBe(true);
  });

  it('detects "Invalid PRF output: all zeros"', () => {
    expect(isPrfUnsupportedError(new Error('Invalid PRF output: all zeros'))).toBe(true);
  });

  it('detects the message even when wrapped in additional context', () => {
    expect(
      isPrfUnsupportedError(new Error('createNostrKey failed: PRF secret not available'))
    ).toBe(true);
  });

  it('handles non-Error values via String()', () => {
    expect(isPrfUnsupportedError('PRF secret not available')).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isPrfUnsupportedError(new Error('Authentication failed'))).toBe(false);
  });
});

describe('formatAuthError', () => {
  it('returns only the PRF guidance message for PRF errors', () => {
    expect(
      formatAuthError('Login Error:', PRF_UNSUPPORTED, new Error('PRF secret not available'))
    ).toBe(PRF_UNSUPPORTED);
  });

  it('returns prefix + raw message for unrelated errors', () => {
    expect(formatAuthError('Login Error:', PRF_UNSUPPORTED, new Error('boom'))).toBe(
      'Login Error: boom'
    );
  });

  it('stringifies non-Error values for unrelated errors', () => {
    expect(formatAuthError('Login Error:', PRF_UNSUPPORTED, 'boom')).toBe('Login Error: boom');
  });
});
