import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNosskeyManager, resetNosskeyManager } from '../services/nosskey-manager.service.js';
import {
  collectStorageDiagnostics,
  debugLog,
  describeError,
  logStorageDiagnostics,
  resetDebugConsoleForTest,
  startDebugConsole,
} from './debug-console.js';

const createConsoleViewer = vi.fn();
vi.mock('console-daijin', () => ({
  createConsoleViewer: (...args: unknown[]) => createConsoleViewer(...args),
}));

/** happy-dom の location を書き換えて `?debug=1` の有無を切り替える。 */
function setUrl(search: string): void {
  window.history.pushState({}, '', `/${search}`);
}

/** `reason` を持たせた合成イベント。happy-dom には PromiseRejectionEvent が無い。 */
function rejectionEvent(reason: unknown): Event {
  const event = new Event('unhandledrejection') as Event & { reason?: unknown };
  event.reason = reason;
  return event;
}

beforeEach(() => {
  resetDebugConsoleForTest();
  resetNosskeyManager();
  createConsoleViewer.mockReset();
  createConsoleViewer.mockReturnValue(undefined);
  setUrl('');
  // 前テストが残した cookie を消す（テスト間で診断結果が混ざらないように）。
  for (const pair of document.cookie.split(';')) {
    const name = pair.trim().split('=')[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
  localStorage.clear();
});

afterEach(() => {
  resetDebugConsoleForTest();
  vi.restoreAllMocks();
});

describe('debugLog', () => {
  it('is a no-op without the debug flag', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    debugLog('hello');
    expect(info).not.toHaveBeenCalled();
  });

  it('logs under a stable prefix with the debug flag', () => {
    setUrl('?debug=1');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    debugLog('hello', { a: 1 });
    expect(info).toHaveBeenCalledWith('[nosskey:debug]', 'hello', { a: 1 });
  });
});

describe('describeError', () => {
  it('keeps the DOMException name, which is what the SAA diagnosis turns on', () => {
    expect(describeError(new DOMException('nope', 'NotAllowedError'))).toBe(
      'DOMException/NotAllowedError: nope'
    );
  });

  it('renders plain errors and non-errors', () => {
    expect(describeError(new TypeError('bad'))).toBe('TypeError: bad');
    expect(describeError('boom')).toBe('boom');
  });
});

describe('collectStorageDiagnostics', () => {
  it('reads live localStorage and cookies without exposing their values', () => {
    const keyInfo = JSON.stringify({ credentialId: 'aa', pubkey: 'bb', salt: 'cc' });
    localStorage.setItem('nosskey_pwk', keyInfo);
    document.cookie = `nosskey:nosskey_pwk=${encodeURIComponent(keyInfo)}; Path=/`;

    const report = collectStorageDiagnostics();
    expect(report.localStorage.entries).toEqual([
      { key: 'nosskey_pwk', length: keyInfo.length, mode: 'direct' },
    ]);
    expect(report.cookie.nosskey[0].key).toBe('nosskey:nosskey_pwk');
    expect(report.cookie.nosskey[0].mode).toBe('direct');
    expect(JSON.stringify(report)).not.toContain('aa');
  });

  it('reports an uninitialised manager instead of constructing one', () => {
    expect(collectStorageDiagnostics().manager).toEqual({
      initialized: false,
      storageKind: 'not-initialized',
      entries: [],
    });
  });

  // 回帰ガード: `hasKeyInfo()` は読み込んだ鍵情報をメモリへキャッシュし、旧 salt を
  // 検出するとストレージへ書き戻す。診断がこれを呼ぶと、後続の applyStorageGrant()
  // の判定が計測の有無で変わり、調査結果そのものが歪む。
  it('never calls the SDK state accessors, which mutate manager state', () => {
    const manager = getNosskeyManager();
    const hasKeyInfo = vi.spyOn(manager, 'hasKeyInfo');
    const getCurrentKeyInfo = vi.spyOn(manager, 'getCurrentKeyInfo');

    const report = collectStorageDiagnostics();

    expect(hasKeyInfo).not.toHaveBeenCalled();
    expect(getCurrentKeyInfo).not.toHaveBeenCalled();
    expect(report.manager.initialized).toBe(true);
  });

  it('reads the key info through the manager storage handle', () => {
    const keyInfo = JSON.stringify({ credentialId: 'aa', pubkey: 'bb', salt: 'cc' });
    const manager = getNosskeyManager();
    manager.getStorageOptions().storage?.setItem('nosskey_pwk', keyInfo);

    expect(collectStorageDiagnostics().manager.entries).toEqual([
      { key: 'nosskey_pwk', length: keyInfo.length, mode: 'direct' },
    ]);
  });
});

describe('logStorageDiagnostics', () => {
  it('stays silent without the debug flag', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logStorageDiagnostics('boot');
    expect(info).not.toHaveBeenCalled();
  });

  it('prints the label with the snapshot', () => {
    setUrl('?debug=1');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logStorageDiagnostics('boot');
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).toContain('[nosskey:debug] boot');
  });
});

describe('startDebugConsole', () => {
  it('does nothing without the debug flag', async () => {
    await startDebugConsole();
    expect(createConsoleViewer).not.toHaveBeenCalled();
  });

  it('mounts the viewer once even when called repeatedly', async () => {
    setUrl('?debug=1');
    await startDebugConsole();
    await startDebugConsole();
    expect(createConsoleViewer).toHaveBeenCalledTimes(1);
    expect(createConsoleViewer).toHaveBeenCalledWith({ show: 'always', height: 200 });
  });

  it('honours a custom panel height', async () => {
    setUrl('?debug=1');
    await startDebugConsole({ height: 80 });
    expect(createConsoleViewer).toHaveBeenCalledWith({ show: 'always', height: 80 });
  });

  it('shrinks the panel inside a frame so it cannot cover the consent card', async () => {
    setUrl('?debug=1');
    const originalTop = window.top;
    Object.defineProperty(window, 'top', { value: {}, configurable: true });
    try {
      await startDebugConsole();
      expect(createConsoleViewer).toHaveBeenCalledWith({ show: 'always', height: 120 });
    } finally {
      Object.defineProperty(window, 'top', { value: originalTop, configurable: true });
    }
  });

  it('keeps the uncaught bridge when the viewer import fails', async () => {
    setUrl('?debug=1');
    createConsoleViewer.mockImplementation(() => {
      throw new Error('bundle missing');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await startDebugConsole();

    expect(warn).toHaveBeenCalled();
    window.dispatchEvent(rejectionEvent(new Error('still captured')));
    expect(error).toHaveBeenCalledWith(
      '[nosskey:debug] unhandledrejection',
      'Error: still captured'
    );
  });

  it('forwards unhandled rejections — the silent-failure path this investigation targets', async () => {
    setUrl('?debug=1');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await startDebugConsole();

    window.dispatchEvent(rejectionEvent(new DOMException('nope', 'InvalidStateError')));

    expect(error).toHaveBeenCalledWith(
      '[nosskey:debug] unhandledrejection',
      'DOMException/InvalidStateError: nope'
    );
  });

  it('forwards uncaught errors, including resource failures with no message', async () => {
    setUrl('?debug=1');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await startDebugConsole();

    window.dispatchEvent(new Event('error'));

    expect(error).toHaveBeenCalledWith(
      '[nosskey:debug] uncaught',
      '(no message)',
      expect.any(String)
    );
  });

  it('removes the bridge on reset so listeners do not pile up', async () => {
    setUrl('?debug=1');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await startDebugConsole();
    resetDebugConsoleForTest();

    window.dispatchEvent(rejectionEvent(new Error('after reset')));

    expect(error).not.toHaveBeenCalled();
  });
});
