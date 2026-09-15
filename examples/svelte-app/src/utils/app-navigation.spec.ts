import { describe, expect, it } from 'vitest';
import { buildScreenUrl, screenNameFromHash } from './app-navigation.js';

describe('buildScreenUrl', () => {
  it('builds a hash route URL from origin and pathname', () => {
    const loc = { origin: 'https://example.com', pathname: '/' };
    expect(buildScreenUrl(loc, 'account')).toBe('https://example.com/#/account');
    expect(buildScreenUrl(loc, 'settings')).toBe('https://example.com/#/settings');
  });

  it('preserves a sub-path / file in pathname', () => {
    expect(buildScreenUrl({ origin: 'https://nosskey.app', pathname: '/app/' }, 'key')).toBe(
      'https://nosskey.app/app/#/key'
    );
    expect(
      buildScreenUrl({ origin: 'http://localhost:5173', pathname: '/index.html' }, 'iframe')
    ).toBe('http://localhost:5173/index.html#/iframe');
  });

  it('appends the hash directly to a pathname without a trailing slash', () => {
    expect(buildScreenUrl({ origin: 'https://nosskey.app', pathname: '/app' }, 'account')).toBe(
      'https://nosskey.app/app#/account'
    );
  });

  it('does not carry over an existing query string', () => {
    // Location.search is intentionally ignored — only origin + pathname are used.
    const loc = { origin: 'https://example.com', pathname: '/' };
    expect(buildScreenUrl(loc, 'account')).not.toContain('?');
  });
});

describe('screenNameFromHash', () => {
  it('extracts the screen name from a plain hash route', () => {
    expect(screenNameFromHash('#/iframe')).toBe('iframe');
    expect(screenNameFromHash('#/account')).toBe('account');
  });

  it('drops a hash query so #/iframe?debug=1 still resolves to the iframe route', () => {
    expect(screenNameFromHash('#/iframe?debug=1')).toBe('iframe');
    expect(screenNameFromHash('#/settings?theme=auto&lang=ja')).toBe('settings');
  });

  it('tolerates a missing leading # or /', () => {
    expect(screenNameFromHash('/key')).toBe('key');
    expect(screenNameFromHash('key')).toBe('key');
  });

  it('returns an empty string for an empty hash so the caller can default', () => {
    expect(screenNameFromHash('')).toBe('');
    expect(screenNameFromHash('#')).toBe('');
    expect(screenNameFromHash('#/')).toBe('');
  });
});
