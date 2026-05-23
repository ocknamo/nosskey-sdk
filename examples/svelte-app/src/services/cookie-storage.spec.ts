import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieStorage } from './cookie-storage.js';

// 簡易 cookie jar。`document.cookie` の getter/setter 動作を模擬する。
// setter には Set-Cookie 形式の 1 件の文字列が渡されるので、name=value 部だけを
// 取り出して内部 Map に格納する。Max-Age=0 のときは削除扱い。
function makeFakeDocument(): { cookie: string; raw: Map<string, string> } {
  const jar = new Map<string, string>();
  return {
    get cookie(): string {
      return Array.from(jar.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    },
    set cookie(input: string) {
      const segments = input.split(';').map((s) => s.trim());
      if (segments.length === 0) return;
      const head = segments[0];
      const eq = head.indexOf('=');
      if (eq < 0) return;
      const name = head.slice(0, eq);
      const value = head.slice(eq + 1);
      const maxAgeSeg = segments.find((s) => /^Max-Age=/i.test(s));
      const maxAge = maxAgeSeg ? Number(maxAgeSeg.split('=')[1]) : undefined;
      if (maxAge === 0) {
        jar.delete(name);
      } else {
        jar.set(name, value);
      }
    },
    raw: jar,
  };
}

describe('CookieStorage', () => {
  let doc: ReturnType<typeof makeFakeDocument>;
  let storage: CookieStorage;

  beforeEach(() => {
    doc = makeFakeDocument();
    storage = new CookieStorage({ document: doc });
  });

  it('setItem→getItem でラウンドトリップする', () => {
    storage.setItem('nosskey_pwk', 'hello');
    expect(storage.getItem('nosskey_pwk')).toBe('hello');
  });

  it('存在しないキーは null を返す', () => {
    expect(storage.getItem('missing')).toBeNull();
  });

  it('特殊文字 (; , = " { }) を含む値を round-trip できる', () => {
    const tricky = '{"a":"x;y, z=1","b":"\\"quoted\\""}';
    storage.setItem('k', tricky);
    expect(storage.getItem('k')).toBe(tricky);
  });

  it('cookie 名はプレフィクスで名前空間化される', () => {
    storage.setItem('alpha', 'A');
    // デフォルトプレフィクスは 'nosskey:'
    expect(doc.raw.has('nosskey:alpha')).toBe(true);
    expect(doc.raw.has('alpha')).toBe(false);
  });

  it('カスタムプレフィクスを尊重する', () => {
    const s = new CookieStorage({ document: doc, prefix: 'custom-' });
    s.setItem('k', 'v');
    expect(doc.raw.has('custom-k')).toBe(true);
  });

  it('setItem は Path / SameSite=None / Secure / Max-Age 属性を含む', () => {
    let captured = '';
    const trapping = {
      get cookie() {
        return '';
      },
      set cookie(input: string) {
        captured = input;
      },
    };
    const s = new CookieStorage({ document: trapping });
    s.setItem('k', 'v');
    expect(captured).toContain('Path=/');
    expect(captured).toContain('SameSite=None');
    expect(captured).toContain('Secure');
    expect(captured).toMatch(/Max-Age=\d+/);
  });

  it('removeItem は Max-Age=0 を使って cookie を evict する', () => {
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('破損した cookie 値 (decodeURIComponent 失敗) は null を返す', () => {
    // 不正なパーセントシーケンスを直接 jar に入れる
    doc.raw.set('nosskey:bad', '%E0%A4%A');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(storage.getItem('bad')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('clear は自プレフィクスの cookie のみ削除する', () => {
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    doc.raw.set('foreign', 'keep-me');
    storage.clear();
    expect(storage.getItem('a')).toBeNull();
    expect(storage.getItem('b')).toBeNull();
    expect(doc.raw.get('foreign')).toBe('keep-me');
  });

  it('length / key は自プレフィクスの cookie のみカウント', () => {
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    doc.raw.set('foreign', 'x');
    expect(storage.length).toBe(2);
    const names = new Set<string>();
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) names.add(k);
    }
    expect(names).toEqual(new Set(['a', 'b']));
    expect(storage.key(999)).toBeNull();
  });
});
