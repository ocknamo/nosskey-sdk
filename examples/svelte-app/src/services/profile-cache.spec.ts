// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PROFILE_CACHE_KEY,
  isSafePictureUrl,
  loadCachedProfile,
  pruneCache,
  saveCachedProfile,
} from './profile-cache.js';

describe('isSafePictureUrl', () => {
  it('https URL を正規化して返す', () => {
    expect(isSafePictureUrl('https://example.com/avatar.png')).toBe(
      'https://example.com/avatar.png'
    );
  });

  it.each([
    ['http URL', 'http://example.com/avatar.png'],
    ['data URL', 'data:image/png;base64,AAAA'],
    ['blob URL', 'blob:https://example.com/abcd'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['file URL', 'file:///etc/passwd'],
    ['localhost', 'https://localhost/x.png'],
    ['IPv4 loopback', 'https://127.0.0.1/x.png'],
    ['IPv4 loopback subrange', 'https://127.1.2.3/x.png'],
    ['IPv6 loopback (bracketed)', 'https://[::1]/x.png'],
    ['username 付き URL', 'https://user@example.com/a.png'],
    ['user:pass 付き URL', 'https://user:pass@example.com/a.png'],
    ['不正な URL', 'not a url'],
    ['空文字', ''],
    ['undefined', undefined],
    ['null', null],
  ])('%s は拒否する', (_label, input) => {
    expect(isSafePictureUrl(input)).toBeNull();
  });
});

describe('profile cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('save→load でラウンドトリップする', () => {
    saveCachedProfile('pub1', {
      picture: 'https://example.com/a.png',
      name: 'alice',
      updatedAt: 1000,
    });
    const loaded = loadCachedProfile('pub1');
    expect(loaded).toEqual({
      picture: 'https://example.com/a.png',
      name: 'alice',
      updatedAt: 1000,
    });
  });

  it('未保存の pubkey に対しては null を返す', () => {
    expect(loadCachedProfile('unknown')).toBeNull();
  });

  it('破損した JSON は null として扱う', () => {
    localStorage.setItem(PROFILE_CACHE_KEY, '{not-json');
    expect(loadCachedProfile('any')).toBeNull();
  });

  it('配列やプリミティブ等の不正な root は無視する', () => {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify([1, 2]));
    expect(loadCachedProfile('any')).toBeNull();
  });

  it('picture が null のエントリも有効として読み戻せる', () => {
    saveCachedProfile('pub1', { picture: null, updatedAt: 5 });
    expect(loadCachedProfile('pub1')).toEqual({ picture: null, updatedAt: 5 });
  });

  it('上限を超えると updatedAt が古いものから FIFO で間引く', () => {
    for (let i = 0; i < 5; i++) {
      saveCachedProfile(`pub${i}`, { picture: null, updatedAt: i }, undefined, 3);
    }
    expect(loadCachedProfile('pub0')).toBeNull();
    expect(loadCachedProfile('pub1')).toBeNull();
    expect(loadCachedProfile('pub2')).not.toBeNull();
    expect(loadCachedProfile('pub4')).not.toBeNull();
  });

  it('pruneCache 単独でも FIFO トリムができる', () => {
    saveCachedProfile('pubA', { picture: null, updatedAt: 1 });
    saveCachedProfile('pubB', { picture: null, updatedAt: 2 });
    saveCachedProfile('pubC', { picture: null, updatedAt: 3 });
    pruneCache(undefined, 1);
    expect(loadCachedProfile('pubA')).toBeNull();
    expect(loadCachedProfile('pubB')).toBeNull();
    expect(loadCachedProfile('pubC')).not.toBeNull();
  });
});
