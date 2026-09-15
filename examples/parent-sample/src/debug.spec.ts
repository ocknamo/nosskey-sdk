import { describe, expect, it } from 'vitest';
import { isDebugEnabled, withIframeDebugFlag } from './debug.js';

const BASE = 'https://ocknamo.github.io/nosskey-sdk/';

describe('isDebugEnabled', () => {
  it('reads the flag from the search query', () => {
    expect(isDebugEnabled({ search: '?debug=1' })).toBe(true);
    expect(isDebugEnabled({ search: '?debug' })).toBe(true);
    expect(isDebugEnabled({ search: '?debug=0' })).toBe(false);
    expect(isDebugEnabled({ search: '' })).toBe(false);
  });
});

describe('withIframeDebugFlag', () => {
  it('adds debug=1 to the search query and keeps the hash route', () => {
    expect(withIframeDebugFlag('https://nosskey.app/#/iframe', true, BASE)).toBe(
      'https://nosskey.app/?debug=1#/iframe'
    );
  });

  it('leaves the URL untouched when disabled', () => {
    expect(withIframeDebugFlag('https://nosskey.app/#/iframe', false, BASE)).toBe(
      'https://nosskey.app/#/iframe'
    );
  });

  it('keeps an empty input empty so the caller can still reject it', () => {
    expect(withIframeDebugFlag('', true, BASE)).toBe('');
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(withIframeDebugFlag('http://', true, BASE)).toBe('http://');
  });
});
