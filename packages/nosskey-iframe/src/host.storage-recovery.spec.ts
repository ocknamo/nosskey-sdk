import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeHost, STORAGE_READY_TIMEOUT_MS } from './host.js';
import type { DispatchableWindow } from './host.test-helpers.js';
import { createFakeWindow, makeManager } from './host.test-helpers.js';
import { isNosskeyReady, isNosskeyVisibility } from './protocol.js';

const ORIGIN = 'https://parent.example';

/** `win.sent` から nosskey:ready だけを数える。 */
function readyCount(win: DispatchableWindow): number {
  return win.sent.filter((entry) => isNosskeyReady(entry.data)).length;
}

/** 可視性メッセージの visible 値を順に並べる。 */
function visibilityFlags(win: DispatchableWindow): boolean[] {
  return win.sent
    .filter((entry) => isNosskeyVisibility(entry.data))
    .map((entry) => (entry.data as { visible: boolean }).visible);
}

function errorCodeOf(win: DispatchableWindow): string | undefined {
  const response = win.sent.find(
    (entry) => (entry.data as { type?: string }).type === 'nosskey:response'
  );
  return (response?.data as { error?: { code: string } } | undefined)?.error?.code;
}

async function requestPublicKey(win: DispatchableWindow): Promise<void> {
  await win.dispatchMessage(
    { type: 'nosskey:request', id: 'req-1', method: 'getPublicKey' },
    ORIGIN
  );
}

describe('NosskeyIframeHost storage readiness', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  function makeHost(options: Record<string, unknown> = {}) {
    const win = createFakeWindow() as DispatchableWindow;
    // parent を別 Window にして ready の宛先を sent に落とす。
    const parent = { postMessage: (data: unknown) => win.sent.push({ data, targetOrigin: '*' }) };
    Object.defineProperty(win, 'parent', { value: parent, configurable: true });
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: [ORIGIN],
      requireUserConsent: false,
      window: win as unknown as Window,
      ...options,
    });
    return { win, host };
  }

  // storageReady 未指定のときに ready が同期で出ることは既存挙動。ここを崩すと
  // 統合者の「start() 直後に ready 済み」という前提が壊れるので固定する。
  it('announces readiness synchronously when no gate is given', () => {
    const { win, host } = makeHost();
    host.start();
    expect(readyCount(win)).toBe(1);
  });

  it('holds the handshake until the storage gate settles', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { win, host } = makeHost({ storageReady: gate });

    host.start();
    expect(readyCount(win)).toBe(0);

    release();
    await gate;
    await Promise.resolve();

    expect(readyCount(win)).toBe(1);
  });

  // ストレージ回復の失敗は「親を待たせ続ける」理由にならない。
  it('still announces readiness when the gate rejects', async () => {
    const gate = Promise.reject(new Error('storage unavailable'));
    const { win, host } = makeHost({ storageReady: gate });

    host.start();
    await gate.catch(() => {});
    await Promise.resolve();

    expect(readyCount(win)).toBe(1);
  });

  it('announces readiness anyway once the gate exceeds the cap', async () => {
    vi.useFakeTimers();
    const { win, host } = makeHost({ storageReady: new Promise<void>(() => {}) });

    host.start();
    expect(readyCount(win)).toBe(0);

    await vi.advanceTimersByTimeAsync(STORAGE_READY_TIMEOUT_MS);

    expect(readyCount(win)).toBe(1);
  });

  it('does not announce readiness for a host stopped while the gate was pending', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { win, host } = makeHost({ storageReady: gate });

    host.start();
    host.stop();
    release();
    await gate;
    await Promise.resolve();

    expect(readyCount(win)).toBe(0);
  });
});

describe('NosskeyIframeHost key recovery', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  /** hasKeyInfo が false から始まり、recover() を呼ぶと true になるマネージャ。 */
  function makeRecoverableManager(publicKey = 'pub') {
    let present = false;
    const manager = makeManager({
      hasKeyInfo: vi.fn(() => present),
      getPublicKey: vi.fn(async () => publicKey),
    });
    return { manager, recover: () => (present = true) };
  }

  function makeHost(options: Record<string, unknown>) {
    const win = createFakeWindow() as DispatchableWindow;
    // 可視性メッセージの宛先は window.parent。自分自身のままだと host が
    // 送信を省くので、別 Window に差し替えて sent へ落とす。
    const parent = { postMessage: (data: unknown) => win.sent.push({ data, targetOrigin: '*' }) };
    Object.defineProperty(win, 'parent', { value: parent, configurable: true });
    const host = new NosskeyIframeHost({
      allowedOrigins: [ORIGIN],
      requireUserConsent: false,
      window: win as unknown as Window,
      ...options,
    } as never);
    host.start();
    return win;
  }

  // 本題。WebKit では鍵が見えるようになるのがユーザーのタップ後なので、
  // その前に NO_KEY を返すと親は回復前にあきらめてしまう。
  it('waits for recovery and then serves the request', async () => {
    const { manager, recover } = makeRecoverableManager('abc');
    const onKeyUnavailable = vi.fn(async () => {
      recover();
      return true;
    });
    const win = makeHost({ manager, onKeyUnavailable });

    await requestPublicKey(win);

    expect(onKeyUnavailable).toHaveBeenCalledTimes(1);
    const response = win.sent.find(
      (entry) => (entry.data as { type?: string }).type === 'nosskey:response'
    );
    expect((response?.data as { result?: string } | undefined)?.result).toBe('abc');
  });

  it('reveals the iframe while recovering and hides it afterwards', async () => {
    const { manager, recover } = makeRecoverableManager();
    let flagsDuringRecovery: boolean[] = [];
    const win = makeHost({
      manager,
      onKeyUnavailable: async () => {
        // 回復 UI を操作できるよう、この時点で iframe は見えている必要がある。
        flagsDuringRecovery = visibilityFlags(win);
        recover();
        return true;
      },
    });

    await requestPublicKey(win);

    expect(flagsDuringRecovery).toEqual([true]);
    expect(visibilityFlags(win)).toEqual([true, false]);
  });

  it('fails with NO_KEY when the user dismisses the recovery UI', async () => {
    const { manager } = makeRecoverableManager();
    const win = makeHost({ manager, onKeyUnavailable: async () => false });

    await requestPublicKey(win);

    expect(errorCodeOf(win)).toBe('NO_KEY');
  });

  // ハンドラの自己申告ではなく、実際に読めるようになったかで判定する。
  it('fails with NO_KEY when recovery claims success but no key appeared', async () => {
    const { manager } = makeRecoverableManager();
    const win = makeHost({ manager, onKeyUnavailable: async () => true });

    await requestPublicKey(win);

    expect(errorCodeOf(win)).toBe('NO_KEY');
  });

  it('keeps the immediate NO_KEY and stays hidden without a recovery handler', async () => {
    const { manager } = makeRecoverableManager();
    const win = makeHost({ manager });

    await requestPublicKey(win);

    expect(errorCodeOf(win)).toBe('NO_KEY');
    expect(visibilityFlags(win)).toEqual([]);
  });

  // 回復 UI の連続拒否でも iframe を開かせ続けられないようにする。
  it('counts a dismissed recovery towards the per-origin rate limit', async () => {
    const { manager } = makeRecoverableManager();
    const onKeyUnavailable = vi.fn(async () => false);
    const win = makeHost({
      manager,
      requireUserConsent: true,
      onConsent: async () => true,
      onKeyUnavailable,
      rateLimit: { maxConsecutiveRejections: 2, blockMs: 60_000 },
    });

    await requestPublicKey(win);
    await requestPublicKey(win);
    await requestPublicKey(win);

    expect(onKeyUnavailable).toHaveBeenCalledTimes(2);
    const last = win.sent[win.sent.length - 1];
    expect((last.data as { error?: { code: string } }).error?.code).toBe('RATE_LIMITED');
  });
});
