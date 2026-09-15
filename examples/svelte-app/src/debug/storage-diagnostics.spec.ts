import { describe, expect, it, vi } from 'vitest';
import {
  buildStorageDiagnostics,
  classifyKeyInfo,
  type DiagnosticsSources,
  formatStorageDiagnostics,
} from './storage-diagnostics.js';

const DIRECT = JSON.stringify({ credentialId: 'aa', pubkey: 'bb', salt: 'cc' });
const WRAPPED = JSON.stringify({
  credentialId: 'aa',
  pubkey: 'bb',
  salt: 'cc',
  wrapped: { v: 1, alg: 'nip44-v2', payload: 'xx' },
});

function fakeStorage(entries: Record<string, string>): Storage {
  return {
    getItem: (key: string) => entries[key] ?? null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: Object.keys(entries).length,
  } as unknown as Storage;
}

function sources(overrides: Partial<DiagnosticsSources> = {}): DiagnosticsSources {
  return {
    location: { origin: 'https://nosskey.app', pathname: '/', hash: '#/iframe?debug=1' },
    userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    framed: true,
    secureContext: true,
    hasStorageAccessApi: true,
    localStorage: fakeStorage({}),
    cookie: '',
    manager: { initialized: true, storage: null },
    ...overrides,
  };
}

describe('classifyKeyInfo', () => {
  it('classifies direct-mode and wrap-mode key info', () => {
    expect(classifyKeyInfo(DIRECT)).toBe('direct');
    expect(classifyKeyInfo(WRAPPED)).toBe('wrap');
  });

  it('classifies a registry array, including a mixed one', () => {
    expect(classifyKeyInfo(`[${DIRECT}]`)).toBe('direct');
    expect(classifyKeyInfo(`[${WRAPPED}]`)).toBe('wrap');
    expect(classifyKeyInfo(`[${DIRECT},${WRAPPED}]`)).toBe('mixed');
  });

  it('treats absent, empty and empty-array values as empty', () => {
    expect(classifyKeyInfo(null)).toBe('empty');
    expect(classifyKeyInfo('')).toBe('empty');
    expect(classifyKeyInfo('[]')).toBe('empty');
  });

  it('reports unparsable values without throwing', () => {
    expect(classifyKeyInfo('{oops')).toBe('unparsable');
    expect(classifyKeyInfo('["not an object"]')).toBe('unparsable');
  });
});

describe('buildStorageDiagnostics', () => {
  it('records localStorage key names, lengths and modes but never values', () => {
    const report = buildStorageDiagnostics(
      sources({
        localStorage: fakeStorage({ nosskey_pwk: DIRECT, nosskey_accounts: `[${WRAPPED}]` }),
      })
    );
    expect(report.localStorage.available).toBe(true);
    expect(report.localStorage.entries).toEqual([
      { key: 'nosskey_pwk', length: DIRECT.length, mode: 'direct' },
      { key: 'nosskey_accounts', length: `[${WRAPPED}]`.length, mode: 'wrap' },
    ]);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('aa');
    expect(serialized).not.toContain('payload');
  });

  it('reports a missing localStorage as unavailable', () => {
    const report = buildStorageDiagnostics(
      sources({ localStorage: null, localStorageError: 'SecurityError' })
    );
    expect(report.localStorage).toEqual({
      available: false,
      entries: [],
      error: 'SecurityError',
    });
  });

  it('marks localStorage unavailable when getItem throws', () => {
    const throwing = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    } as unknown as Storage;
    const report = buildStorageDiagnostics(sources({ localStorage: throwing }));
    expect(report.localStorage.available).toBe(false);
    expect(report.localStorage.error).toBe('SecurityError');
  });

  it('counts every cookie but details only the nosskey-prefixed ones', () => {
    const encoded = encodeURIComponent(DIRECT);
    const report = buildStorageDiagnostics(
      sources({ cookie: `other=1; nosskey:nosskey_pwk=${encoded}` })
    );
    expect(report.cookie.total).toBe(2);
    expect(report.cookie.nosskey).toEqual([
      { key: 'nosskey:nosskey_pwk', length: encoded.length, mode: 'direct' },
    ]);
    // 4KB 上限の判定に効くのはエンコード後の長さなので、生の JSON より長い。
    expect(report.cookie.nosskey[0].length).toBeGreaterThan(DIRECT.length);
  });

  it('flags a cookie whose percent-encoding is broken', () => {
    const report = buildStorageDiagnostics(sources({ cookie: 'nosskey:nosskey_pwk=%E0%A4%A' }));
    expect(report.cookie.nosskey[0].mode).toBe('unparsable');
  });

  it('reports the manager storage implementation name and reads through that handle', () => {
    class CookieStorage {
      getItem(key: string): string | null {
        return key === 'nosskey_pwk' ? WRAPPED : null;
      }
    }
    const report = buildStorageDiagnostics(
      sources({
        // SAA グラント後は manager のハンドルと window.localStorage が食い違う。
        // その差分が見えることが本項目の目的。
        localStorage: fakeStorage({ nosskey_pwk: DIRECT }),
        manager: { initialized: true, storage: new CookieStorage() as unknown as Storage },
      })
    );
    expect(report.manager).toEqual({
      initialized: true,
      storageKind: 'CookieStorage',
      entries: [{ key: 'nosskey_pwk', length: WRAPPED.length, mode: 'wrap' }],
    });
    expect(report.localStorage.entries[0].mode).toBe('direct');
  });

  it('records a throwing manager storage without losing the rest of the report', () => {
    const throwing = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    } as unknown as Storage;
    const report = buildStorageDiagnostics(
      sources({ manager: { initialized: true, storage: throwing } })
    );
    expect(report.manager.error).toBe('SecurityError');
    expect(report.manager.entries).toEqual([]);
    expect(report.route).toBe('/iframe');
  });

  // 回帰ガード: MultiStorage.getItem() はミラーヒット時に primary へ書き戻すため、
  // 診断がそれを呼ぶと「partitioned localStorage に鍵が見えるか」という最重要の
  // 判定を計測自身が偽陰性にする。peekItem を持つ実装では必ずそちらを使う。
  it('prefers the side-effect-free peekItem when the storage offers one', () => {
    const getItem = vi.fn(() => DIRECT);
    const peekItem = vi.fn((key: string) => (key === 'nosskey_pwk' ? DIRECT : null));
    const peekable = { getItem, peekItem } as unknown as Storage;

    const report = buildStorageDiagnostics(
      sources({ manager: { initialized: true, storage: peekable } })
    );

    expect(peekItem).toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(report.manager.entries).toEqual([
      { key: 'nosskey_pwk', length: DIRECT.length, mode: 'direct' },
    ]);
  });

  it('reads the storage keys the manager is actually configured with', () => {
    const custom = fakeStorage({ custom_current: DIRECT });
    const report = buildStorageDiagnostics(
      sources({
        manager: {
          initialized: true,
          storage: custom,
          storageKeys: ['custom_current', 'custom_registry'],
        },
      })
    );
    expect(report.manager.entries).toEqual([
      { key: 'custom_current', length: DIRECT.length, mode: 'direct' },
    ]);
  });

  it('ignores empty or missing configured keys', () => {
    const report = buildStorageDiagnostics(
      sources({
        localStorage: fakeStorage({ nosskey_pwk: DIRECT }),
        manager: { initialized: true, storage: null, storageKeys: [undefined, ''] },
      })
    );
    expect(report.localStorage.entries).toEqual([
      { key: 'nosskey_pwk', length: DIRECT.length, mode: 'direct' },
    ]);
  });

  it('distinguishes an uninitialised manager from one with no storage handle', () => {
    expect(
      buildStorageDiagnostics(sources({ manager: { initialized: false, storage: null } })).manager
        .storageKind
    ).toBe('not-initialized');
    expect(
      buildStorageDiagnostics(sources({ manager: { initialized: true, storage: null } })).manager
        .storageKind
    ).toBe('none');
  });

  it('extracts the hash route without its query part', () => {
    expect(buildStorageDiagnostics(sources()).route).toBe('/iframe');
    expect(
      buildStorageDiagnostics(
        sources({ location: { origin: 'https://nosskey.app', pathname: '/', hash: '' } })
      ).route
    ).toBe('/');
  });

  it('mirrors the UA heuristic that drives the cookie fallback branch', () => {
    expect(buildStorageDiagnostics(sources()).webkitHeuristic).toBe(true);
    expect(
      buildStorageDiagnostics(
        sources({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36' })
      ).webkitHeuristic
    ).toBe(false);
  });
});

describe('formatStorageDiagnostics', () => {
  it('renders one line per section and marks empty sections', () => {
    const text = formatStorageDiagnostics(buildStorageDiagnostics(sources()));
    expect(text.split('\n')).toHaveLength(6);
    expect(text).toContain('localStorage: available=true (none)');
    expect(text).toContain('manager: initialized=true storage=none (none)');
  });
});
