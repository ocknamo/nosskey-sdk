import { describe, expect, it } from 'vitest';
import { appendDebugFlag, isDebugConsoleEnabled } from './debug-flag.js';

describe('isDebugConsoleEnabled', () => {
  it('detects the flag in the search query', () => {
    expect(isDebugConsoleEnabled({ search: '?debug=1', hash: '' })).toBe(true);
    expect(isDebugConsoleEnabled({ search: '?embedded=1&debug=true', hash: '' })).toBe(true);
  });

  it('detects the flag inside the hash query (#/iframe?debug=1)', () => {
    expect(isDebugConsoleEnabled({ search: '', hash: '#/iframe?debug=1' })).toBe(true);
  });

  it('accepts a valueless flag', () => {
    expect(isDebugConsoleEnabled({ search: '?debug', hash: '' })).toBe(true);
  });

  it('is case-insensitive on the value', () => {
    expect(isDebugConsoleEnabled({ search: '?debug=TRUE', hash: '' })).toBe(true);
  });

  it('rejects absent or falsy values', () => {
    expect(isDebugConsoleEnabled({ search: '', hash: '' })).toBe(false);
    expect(isDebugConsoleEnabled({ search: '?debug=0', hash: '' })).toBe(false);
    expect(isDebugConsoleEnabled({ search: '?debug=off', hash: '' })).toBe(false);
    expect(isDebugConsoleEnabled({ search: '?embedded=1', hash: '#/iframe' })).toBe(false);
  });

  it('ignores a hash without a query part', () => {
    expect(isDebugConsoleEnabled({ search: '', hash: '#/iframe' })).toBe(false);
  });
});

describe('appendDebugFlag', () => {
  it('adds debug=1 to the search query and keeps the hash route', () => {
    expect(appendDebugFlag('https://nosskey.app/#/account')).toBe(
      'https://nosskey.app/?debug=1#/account'
    );
  });

  it('keeps existing query parameters', () => {
    expect(appendDebugFlag('https://nosskey.app/?embedded=1#/iframe')).toBe(
      'https://nosskey.app/?embedded=1&debug=1#/iframe'
    );
  });

  it('does not duplicate the flag', () => {
    expect(appendDebugFlag('https://nosskey.app/?debug=1#/iframe')).toBe(
      'https://nosskey.app/?debug=1#/iframe'
    );
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(appendDebugFlag('not a url')).toBe('not a url');
  });
});
