import { describe, expect, it, vi } from 'vitest';
import { NosskeyIframeHost } from './host.js';
import type { DispatchableWindow } from './host.test-helpers.js';
import { createFakeWindow, makeManager } from './host.test-helpers.js';
import type { NosskeyManagerLike } from './types.js';

const ORIGIN = 'https://parent.example';

/**
 * 「リクエストを受ける直前にストレージを読み直す」仕様。
 *
 * 親は iframe を作り直さずに使い回す（作り直すと Storage Access のグラントも
 * 一緒に捨てることになり、タブを切り替えるたびに許可モーダルが出る）。そのぶん
 * host は、マウント時に読んだアカウントを答え続けてはいけない。
 */
describe('NosskeyIframeHost key reload', () => {
  function makeHost(manager: NosskeyManagerLike) {
    const win = createFakeWindow() as DispatchableWindow;
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: [ORIGIN],
      requireUserConsent: false,
      window: win as unknown as Window,
    } as never);
    host.start();
    return { win, host };
  }

  async function request(win: DispatchableWindow, method: string, params?: unknown) {
    await win.dispatchMessage(
      { type: 'nosskey:request', id: `req-${method}`, method, ...(params ? { params } : {}) },
      ORIGIN
    );
  }

  const signParams = {
    event: { kind: 1, content: '', tags: [], created_at: 0, pubkey: '', id: '', sig: '' },
  };

  /** 送信済みメッセージから最初の `nosskey:response` の結果／エラーを取り出す。 */
  function findResponse(win: DispatchableWindow): { result?: unknown; error?: unknown } {
    const sent = win.sent.find((m) => (m.data as { type?: string }).type === 'nosskey:response');
    if (!sent) throw new Error('no nosskey:response was posted');
    const { result, error } = sent.data as { result?: unknown; error?: unknown };
    return { result, error };
  }

  it('reloads the stored account before serving a request', async () => {
    const reloadCurrentKeyInfo = vi.fn();
    const manager = makeManager({
      reloadCurrentKeyInfo,
      getPublicKey: vi.fn(async () => 'pub'),
    });
    const { win } = makeHost(manager);

    await request(win, 'getPublicKey');

    expect(reloadCurrentKeyInfo).toHaveBeenCalledTimes(1);
  });

  // 読み直しは鍵の有無を判定する**前**に起きないと意味がない。別タブで
  // ログインしたユーザーが戻ってきたときに NO_KEY を返してしまう。
  it('reloads before consulting hasKeyInfo', async () => {
    const calls: string[] = [];
    const manager = makeManager({
      reloadCurrentKeyInfo: vi.fn(() => {
        calls.push('reload');
      }),
      hasKeyInfo: vi.fn(() => {
        calls.push('hasKeyInfo');
        return true;
      }),
      getPublicKey: vi.fn(async () => 'pub'),
    });
    const { win } = makeHost(manager);

    await request(win, 'getPublicKey');

    expect(calls[0]).toBe('reload');
    expect(calls).toContain('hasKeyInfo');
  });

  // 別タブでログインした直後の復帰。読み直しで鍵が見えるようになれば、
  // 回復フロー（`onKeyUnavailable`）を通さずにそのまま応答できる。
  it('serves a request that only becomes possible after the reload', async () => {
    let present = false;
    const onKeyUnavailable = vi.fn(async () => false);
    const manager = makeManager({
      reloadCurrentKeyInfo: vi.fn(() => {
        present = true;
      }),
      hasKeyInfo: vi.fn(() => present),
      signEvent: vi.fn(async (event) => event),
    });
    const win = createFakeWindow() as DispatchableWindow;
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: [ORIGIN],
      requireUserConsent: false,
      onKeyUnavailable,
      window: win as unknown as Window,
    } as never);
    host.start();

    await request(win, 'signEvent', signParams);

    expect(onKeyUnavailable).not.toHaveBeenCalled();
    expect(findResponse(win).error).toBeUndefined();
  });

  // 実装していないマネージャ（既存の連携先）はこれまで通り動く。
  it('works with a manager that does not implement the reload', async () => {
    const manager = makeManager({ getPublicKey: vi.fn(async () => 'pub') });
    expect(manager.reloadCurrentKeyInfo).toBeUndefined();
    const { win } = makeHost(manager);

    await request(win, 'getPublicKey');

    expect(findResponse(win).result).toBe('pub');
  });

  it('reloads for every request, not just the first', async () => {
    const reloadCurrentKeyInfo = vi.fn();
    const manager = makeManager({
      reloadCurrentKeyInfo,
      getPublicKey: vi.fn(async () => 'pub'),
      signEvent: vi.fn(async (event) => event),
    });
    const { win } = makeHost(manager);

    await request(win, 'getPublicKey');
    await request(win, 'signEvent', signParams);

    expect(reloadCurrentKeyInfo).toHaveBeenCalledTimes(2);
  });

  // マネージャが投げてもリクエストは壊さない。読み直せなかっただけで、
  // 既に持っているアカウントで応答できる（3rd-party Cookie 全ブロック時の
  // SecurityError など、まさに対象ブラウザで起こりうる）。
  it('serves the request when the reload throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const manager = makeManager({
      reloadCurrentKeyInfo: vi.fn(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      }),
      getPublicKey: vi.fn(async () => 'pub'),
    });
    const { win } = makeHost(manager);

    await request(win, 'getPublicKey');

    expect(findResponse(win).result).toBe('pub');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // 同意を取ったあとにアカウントを差し替えられると、ユーザーが承認したのとは
  // 別のアカウントで実行されてしまう。in-flight がある間は読み直さない。
  it('does not swap the account underneath an in-flight request', async () => {
    const reloadCurrentKeyInfo = vi.fn();
    let releaseFirst: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let gate: (() => void) | undefined;
    const manager = makeManager({
      reloadCurrentKeyInfo,
      signEvent: vi.fn(async (event) => {
        releaseFirst?.();
        await new Promise<void>((resolve) => {
          gate = resolve;
        });
        return event;
      }),
      getPublicKey: vi.fn(async () => 'pub'),
    });
    const { win } = makeHost(manager);

    const first = request(win, 'signEvent', signParams);
    await firstStarted;
    expect(reloadCurrentKeyInfo).toHaveBeenCalledTimes(1);

    // 1 本目が走っている間に 2 本目。読み直しは起きてはいけない。
    const second = request(win, 'getPublicKey');
    // 2 本目が読み直し地点まで到達したことを保証してから数える（マクロタスク待ち）。
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reloadCurrentKeyInfo).toHaveBeenCalledTimes(1);

    gate?.();
    await first;
    await second;

    // 1 本目が終わったあとの次のリクエストでは読み直す。
    await request(win, 'getPublicKey');
    expect(reloadCurrentKeyInfo).toHaveBeenCalledTimes(2);
  });
});
