// startDebugConsole() は window / document を触るため、このファイルだけ DOM 環境で
// 動かす。parent-sample の他のテスト（relay・nip17 等）は node 環境のままにしたいので、
// vitest.config.ts ではなくファイル単位で指定する。
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isDebugEnabled, startDebugConsole, withIframeDebugFlag } from './debug.js';

const createConsoleViewer = vi.fn();
vi.mock('console-daijin', () => ({
  createConsoleViewer: (...args: unknown[]) => createConsoleViewer(...args),
}));

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

describe('startDebugConsole', () => {
  beforeEach(() => {
    createConsoleViewer.mockReset();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing without the debug flag', async () => {
    await startDebugConsole();
    expect(createConsoleViewer).not.toHaveBeenCalled();
  });

  // 回帰ガード: console-daijin の console 差し替えは createConsoleViewer() の末尾で
  // 行われるため、前に出した警告はパネル本文に残らない。共有前確認の注意は
  // ログ全文に同梱されないと意味がない（実際に一度この順序が壊れていた）。
  it('emits the sharing warning only after the viewer has hooked console', async () => {
    window.history.pushState({}, '', '/?debug=1');
    const order: string[] = [];
    createConsoleViewer.mockImplementation(() => {
      order.push('createConsoleViewer');
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      order.push(`warn:${String(args[0]).slice(0, 20)}`);
    });

    await startDebugConsole();

    expect(order[0]).toBe('createConsoleViewer');
    expect(order[1]).toContain('[parent-sample]');
  });
});
