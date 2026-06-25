import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeHost } from './host.js';
import { createFakeWindow, makeManager } from './host.test-helpers.js';
import type { DispatchableWindow } from './host.test-helpers.js';
import { isNosskeyVisibility } from './protocol.js';

describe('NosskeyIframeHost', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('per-origin consent rate limiting', () => {
    const ORIGIN = 'https://parent.example';

    function lastError(win: DispatchableWindow): string | undefined {
      const data = win.sent[win.sent.length - 1]?.data as { error?: { code: string } } | undefined;
      return data?.error?.code;
    }

    async function dispatchSign(win: DispatchableWindow, id: string): Promise<void> {
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id,
          method: 'signEvent',
          params: { event: { kind: 1, content: '' } },
        },
        ORIGIN
      );
    }

    it('blocks an origin with RATE_LIMITED after maxConsecutiveRejections rejections', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const onConsent = vi.fn(async () => false);
      const manager = makeManager();
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: [ORIGIN],
        onConsent,
        rateLimit: { maxConsecutiveRejections: 3, blockMs: 60_000 },
        window: win as unknown as Window,
      });
      host.start();

      // First 3 rejections prompt the user (USER_REJECTED); the 3rd arms the block.
      for (let i = 0; i < 3; i++) await dispatchSign(win, `rej-${i}`);
      expect(onConsent).toHaveBeenCalledTimes(3);
      expect(lastError(win)).toBe('USER_REJECTED');

      // The 4th request is short-circuited without prompting.
      await dispatchSign(win, 'blocked');
      expect(onConsent).toHaveBeenCalledTimes(3);
      expect(lastError(win)).toBe('RATE_LIMITED');
      host.stop();
    });

    it('does not show the iframe (no visibility flicker) while blocked', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const parent = { postMessage: vi.fn() } as unknown as Window;
      Object.defineProperty(win, 'parent', { value: parent, configurable: true });
      const host = new NosskeyIframeHost({
        manager: makeManager(),
        allowedOrigins: [ORIGIN],
        onConsent: async () => false,
        rateLimit: { maxConsecutiveRejections: 1, blockMs: 60_000 },
        window: win as unknown as Window,
      });
      host.start();
      await dispatchSign(win, 'trip'); // arms block (visibility shown+hidden here)
      const postMessage = parent.postMessage as unknown as ReturnType<typeof vi.fn>;
      postMessage.mockClear();
      await dispatchSign(win, 'blocked');
      // No visibility messages posted to parent while blocked.
      const visibilityCalls = postMessage.mock.calls.filter((c) => isNosskeyVisibility(c[0]));
      expect(visibilityCalls).toHaveLength(0);
      host.stop();
    });

    it('resets the counter after a successful approval', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      let approve = false;
      const onConsent = vi.fn(async () => approve);
      const manager = makeManager({
        signEvent: vi.fn(async () => ({ kind: 1, content: '', sig: 's' })),
      });
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: [ORIGIN],
        onConsent,
        rateLimit: { maxConsecutiveRejections: 3, blockMs: 60_000 },
        window: win as unknown as Window,
      });
      host.start();

      await dispatchSign(win, 'r0'); // reject
      await dispatchSign(win, 'r1'); // reject
      approve = true;
      await dispatchSign(win, 'ok'); // approve -> resets
      approve = false;
      await dispatchSign(win, 'r2'); // reject (count back to 1, not blocked)
      await dispatchSign(win, 'r3'); // reject (count 2)
      expect(lastError(win)).toBe('USER_REJECTED'); // still not blocked
      expect(onConsent).toHaveBeenCalledTimes(5);
      host.stop();
    });

    it('lifts the block once blockMs has elapsed', async () => {
      vi.useFakeTimers();
      try {
        const win = createFakeWindow() as DispatchableWindow;
        const onConsent = vi.fn(async () => false);
        const host = new NosskeyIframeHost({
          manager: makeManager(),
          allowedOrigins: [ORIGIN],
          onConsent,
          rateLimit: { maxConsecutiveRejections: 1, blockMs: 60_000 },
          window: win as unknown as Window,
        });
        host.start();

        await dispatchSign(win, 'trip'); // arms block
        await dispatchSign(win, 'blocked');
        expect(lastError(win)).toBe('RATE_LIMITED');

        vi.advanceTimersByTime(60_001);
        await dispatchSign(win, 'after'); // block expired -> prompts again
        expect(lastError(win)).toBe('USER_REJECTED');
        expect(onConsent).toHaveBeenCalledTimes(2);
        host.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('tracks rejections per origin independently', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const onConsent = vi.fn(async () => false);
      const host = new NosskeyIframeHost({
        manager: makeManager(),
        allowedOrigins: ['https://a.example', 'https://b.example'],
        onConsent,
        rateLimit: { maxConsecutiveRejections: 2, blockMs: 60_000 },
        window: win as unknown as Window,
      });
      host.start();
      const sign = (id: string, origin: string) =>
        win.dispatchMessage(
          {
            type: 'nosskey:request',
            id,
            method: 'signEvent',
            params: { event: { kind: 1, content: '' } },
          },
          origin
        );

      await sign('a0', 'https://a.example');
      await sign('a1', 'https://a.example'); // a now blocked
      await sign('b0', 'https://b.example'); // b still allowed to prompt
      expect((win.sent[win.sent.length - 1].data as { error: { code: string } }).error.code).toBe(
        'USER_REJECTED'
      );
      await sign('a2', 'https://a.example');
      expect((win.sent[win.sent.length - 1].data as { error: { code: string } }).error.code).toBe(
        'RATE_LIMITED'
      );
      host.stop();
    });

    it('disables rate limiting when rateLimit is false', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const onConsent = vi.fn(async () => false);
      const host = new NosskeyIframeHost({
        manager: makeManager(),
        allowedOrigins: [ORIGIN],
        onConsent,
        rateLimit: false,
        window: win as unknown as Window,
      });
      host.start();
      for (let i = 0; i < 10; i++) await dispatchSign(win, `r-${i}`);
      expect(onConsent).toHaveBeenCalledTimes(10);
      expect(lastError(win)).toBe('USER_REJECTED');
      host.stop();
    });

    it('throws on invalid rateLimit.maxConsecutiveRejections', () => {
      const win = createFakeWindow();
      expect(
        () =>
          new NosskeyIframeHost({
            manager: makeManager(),
            allowedOrigins: [ORIGIN],
            onConsent: async () => true,
            rateLimit: { maxConsecutiveRejections: 0 },
            window: win as unknown as Window,
          })
      ).toThrow(/maxConsecutiveRejections/);
    });
  });
});
