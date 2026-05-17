import { describe, expect, it } from 'vitest';
import {
  NOSSKEY_ERROR_CODES,
  type NosskeyErrorCode,
  isDecryptMethod,
  isEncryptMethod,
  isNosskeyReady,
  isNosskeyRequest,
  isNosskeyResponse,
  isNosskeyVisibility,
} from './protocol.js';

describe('protocol: isNosskeyRequest', () => {
  it('accepts a well-formed getPublicKey request', () => {
    expect(isNosskeyRequest({ type: 'nosskey:request', id: 'req-1', method: 'getPublicKey' })).toBe(
      true
    );
  });

  it('accepts a well-formed signEvent request with params', () => {
    expect(
      isNosskeyRequest({
        type: 'nosskey:request',
        id: 'req-2',
        method: 'signEvent',
        params: { event: { kind: 1, content: 'hello' } },
      })
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['array', []],
    ['string', 'x'],
    ['number', 7],
    ['empty object', {}],
  ])('rejects non-object-shaped value: %s', (_label, value) => {
    expect(isNosskeyRequest(value)).toBe(false);
  });

  it('rejects wrong type tag', () => {
    expect(isNosskeyRequest({ type: 'nosskey:response', id: 'x', method: 'getPublicKey' })).toBe(
      false
    );
  });

  it('rejects missing id', () => {
    expect(isNosskeyRequest({ type: 'nosskey:request', method: 'getPublicKey' })).toBe(false);
  });

  it('rejects empty id', () => {
    expect(isNosskeyRequest({ type: 'nosskey:request', id: '', method: 'getPublicKey' })).toBe(
      false
    );
  });

  it('rejects non-string id', () => {
    expect(isNosskeyRequest({ type: 'nosskey:request', id: 123, method: 'getPublicKey' })).toBe(
      false
    );
  });

  it('rejects unsupported method', () => {
    expect(isNosskeyRequest({ type: 'nosskey:request', id: 'r', method: 'somethingElse' })).toBe(
      false
    );
  });

  it('accepts nip44 / nip04 encrypt / decrypt methods', () => {
    for (const method of ['nip44_encrypt', 'nip44_decrypt', 'nip04_encrypt', 'nip04_decrypt']) {
      expect(isNosskeyRequest({ type: 'nosskey:request', id: 'r', method })).toBe(true);
    }
  });

  it('rejects non-object params', () => {
    expect(
      isNosskeyRequest({
        type: 'nosskey:request',
        id: 'r',
        method: 'signEvent',
        params: 'bad',
      })
    ).toBe(false);
  });
});

describe('protocol: isNosskeyResponse', () => {
  it('accepts a response with result', () => {
    expect(isNosskeyResponse({ type: 'nosskey:response', id: 'r1', result: 'abcd' })).toBe(true);
  });

  it('accepts a response with explicit undefined result', () => {
    // `result: undefined` still has the property present.
    expect(isNosskeyResponse({ type: 'nosskey:response', id: 'r1', result: undefined })).toBe(true);
  });

  it('accepts a response with a valid error', () => {
    expect(
      isNosskeyResponse({
        type: 'nosskey:response',
        id: 'r1',
        error: { code: 'NO_KEY', message: 'no key' },
      })
    ).toBe(true);
  });

  it('rejects a response with neither result nor error', () => {
    expect(isNosskeyResponse({ type: 'nosskey:response', id: 'r1' })).toBe(false);
  });

  it('rejects a response with an invalid error code', () => {
    expect(
      isNosskeyResponse({
        type: 'nosskey:response',
        id: 'r1',
        error: { code: 'SOMETHING_ELSE', message: 'nope' },
      })
    ).toBe(false);
  });

  it('rejects a response whose error has a non-string message', () => {
    expect(
      isNosskeyResponse({
        type: 'nosskey:response',
        id: 'r1',
        error: { code: 'INTERNAL', message: 5 },
      })
    ).toBe(false);
  });

  it('rejects wrong type tag', () => {
    expect(isNosskeyResponse({ type: 'nosskey:request', id: 'r1', result: 1 })).toBe(false);
  });

  it('rejects missing id', () => {
    expect(isNosskeyResponse({ type: 'nosskey:response', result: 1 })).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['array', []],
    ['string', 'x'],
    ['number', 7],
  ])('rejects non-object-shaped value: %s', (_label, value) => {
    expect(isNosskeyResponse(value)).toBe(false);
  });

  it('rejects a response whose error is not an object', () => {
    expect(isNosskeyResponse({ type: 'nosskey:response', id: 'r1', error: 'boom' })).toBe(false);
  });
});

describe('protocol: isNosskeyReady', () => {
  it('accepts the ready message', () => {
    expect(isNosskeyReady({ type: 'nosskey:ready' })).toBe(true);
  });

  it('rejects other type tags', () => {
    expect(isNosskeyReady({ type: 'nosskey:response' })).toBe(false);
  });

  it.each([null, undefined, 'nosskey:ready', 42, []])('rejects %s', (value) => {
    expect(isNosskeyReady(value)).toBe(false);
  });
});

describe('protocol: isNosskeyVisibility', () => {
  it('accepts visible=true', () => {
    expect(isNosskeyVisibility({ type: 'nosskey:visibility', visible: true })).toBe(true);
  });

  it('accepts visible=false', () => {
    expect(isNosskeyVisibility({ type: 'nosskey:visibility', visible: false })).toBe(true);
  });

  it('rejects wrong type tag', () => {
    expect(isNosskeyVisibility({ type: 'nosskey:ready', visible: true })).toBe(false);
  });

  it('rejects missing visible flag', () => {
    expect(isNosskeyVisibility({ type: 'nosskey:visibility' })).toBe(false);
  });

  it('rejects non-boolean visible flag', () => {
    expect(isNosskeyVisibility({ type: 'nosskey:visibility', visible: 'yes' })).toBe(false);
  });

  it.each([null, undefined, 'nosskey:visibility', 0, []])('rejects %s', (value) => {
    expect(isNosskeyVisibility(value)).toBe(false);
  });
});

describe('protocol: isEncryptMethod', () => {
  it.each(['nip44_encrypt', 'nip04_encrypt'] as const)('returns true for %s', (method) => {
    expect(isEncryptMethod(method)).toBe(true);
  });

  it.each(['getPublicKey', 'signEvent', 'getRelays', 'nip44_decrypt', 'nip04_decrypt'] as const)(
    'returns false for %s',
    (method) => {
      expect(isEncryptMethod(method)).toBe(false);
    }
  );
});

describe('protocol: isDecryptMethod', () => {
  it.each(['nip44_decrypt', 'nip04_decrypt'] as const)('returns true for %s', (method) => {
    expect(isDecryptMethod(method)).toBe(true);
  });

  it.each(['getPublicKey', 'signEvent', 'getRelays', 'nip44_encrypt', 'nip04_encrypt'] as const)(
    'returns false for %s',
    (method) => {
      expect(isDecryptMethod(method)).toBe(false);
    }
  );
});

describe('protocol: NOSSKEY_ERROR_CODES', () => {
  it('enumerates all expected codes in a stable order', () => {
    const expected: NosskeyErrorCode[] = [
      'NOT_AUTHORIZED',
      'NO_KEY',
      'USER_REJECTED',
      'UNKNOWN_METHOD',
      'INVALID_REQUEST',
      'INTERNAL',
    ];
    expect(NOSSKEY_ERROR_CODES).toEqual(expected);
  });
});
