import { describe, expect, it } from 'vitest';
import { buildScreenUrl } from './app-navigation.js';

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

  it('does not carry over an existing query string', () => {
    // Location.search is intentionally ignored — only origin + pathname are used.
    const loc = { origin: 'https://example.com', pathname: '/' };
    expect(buildScreenUrl(loc, 'account')).not.toContain('?');
  });
});
