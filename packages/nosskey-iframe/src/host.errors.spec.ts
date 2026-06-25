import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeHost } from './host.js';
import { createFakeWindow, makeManager } from './host.test-helpers.js';
import type { DispatchableWindow } from './host.test-helpers.js';
import { isNosskeyVisibility } from './protocol.js';
import type { NostrEvent } from './types.js';

describe('NosskeyIframeHost', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('silently drops messages from disallowed origins', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager();
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      window: win as unknown as Window,
    });
    host.start();
    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r6', method: 'getPublicKey' },
      'https://evil.example'
    );
    expect(manager.getPublicKey).not.toHaveBeenCalled();
    expect(win.sent).toHaveLength(0);
    host.stop();
  });

  it('silently drops non-request messages', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: ['https://parent.example'],
      window: win as unknown as Window,
    });
    host.start();
    await win.dispatchMessage('not-a-request', 'https://parent.example');
    expect(win.sent).toHaveLength(0);
    host.stop();
  });

  it('wraps manager exceptions as INTERNAL errors', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager({
      getPublicKey: vi.fn(async () => {
        throw new Error('kaboom');
      }),
    });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      onConsent: async () => true,
      window: win as unknown as Window,
    });
    host.start();
    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r7', method: 'getPublicKey' },
      'https://parent.example'
    );
    const err = (win.sent[0].data as { error: { code: string; message: string } }).error;
    expect(err.code).toBe('INTERNAL');
    expect(err.message).toBe('kaboom');
    host.stop();
  });

  it('wraps a non-Error manager rejection as INTERNAL and still hides the iframe', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(win, 'parent', { value: parent, configurable: true });
    const manager = makeManager({
      // Reject with a plain string rather than an Error to exercise String(err).
      signEvent: vi.fn(() => Promise.reject('manager-non-error-failure')),
    });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      onConsent: async () => true,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      {
        type: 'nosskey:request',
        id: 'i2',
        method: 'signEvent',
        params: { event: { kind: 1, content: '' } },
      },
      'https://parent.example'
    );

    const err = (win.sent[0].data as { error: { code: string; message: string } }).error;
    expect(err.code).toBe('INTERNAL');
    expect(err.message).toBe('manager-non-error-failure');
    // The finally block must still hide the iframe after the operation fails.
    const visibilityMessages = (
      parent.postMessage as unknown as ReturnType<typeof vi.fn>
    ).mock.calls
      .map((c) => c[0])
      .filter(isNosskeyVisibility);
    expect(visibilityMessages.map((m) => m.visible)).toEqual([true, false]);
    host.stop();
  });

  it('returns INTERNAL when requireUserConsent is true but onConsent is missing', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const host = new NosskeyIframeHost({
      manager: makeManager({ signEvent: vi.fn(async () => ({ kind: 1, content: '' })) }),
      allowedOrigins: ['https://parent.example'],
      // onConsent intentionally omitted
      window: win as unknown as Window,
    });
    host.start();
    await win.dispatchMessage(
      {
        type: 'nosskey:request',
        id: 'r8',
        method: 'signEvent',
        params: { event: { kind: 1, content: '' } },
      },
      'https://parent.example'
    );
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('INTERNAL');
    host.stop();
  });

  it('posts visibility true before onConsent and false after signEvent succeeds', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(win, 'parent', { value: parent, configurable: true });
    const input: NostrEvent = { kind: 1, content: 'hi' };
    const signed: NostrEvent = { ...input, id: 'abc', sig: 'def' };
    const visibilityWhenConsentCalled: boolean[] = [];
    const onConsent = vi.fn(async () => {
      // Record every visibility message posted up to this point.
      for (const call of (parent.postMessage as unknown as ReturnType<typeof vi.fn>).mock.calls) {
        if (isNosskeyVisibility(call[0])) {
          visibilityWhenConsentCalled.push((call[0] as { visible: boolean }).visible);
        }
      }
      return true;
    });
    const manager = makeManager({ signEvent: vi.fn(async () => signed) });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      onConsent,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      {
        type: 'nosskey:request',
        id: 'v1',
        method: 'signEvent',
        params: { event: input },
      },
      'https://parent.example'
    );

    // Before onConsent ran, only visibility:true should have been posted.
    expect(visibilityWhenConsentCalled).toEqual([true]);

    const parentMessages = (
      parent.postMessage as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.map((c) => c[0]);
    const visibilityMessages = parentMessages.filter(isNosskeyVisibility);
    expect(visibilityMessages.map((m) => m.visible)).toEqual([true, false]);

    const response = win.sent[0];
    expect((response.data as { result: NostrEvent }).result).toEqual(signed);
    host.stop();
  });

  it('posts visibility false after onConsent rejects signEvent', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(win, 'parent', { value: parent, configurable: true });
    const manager = makeManager({
      signEvent: vi.fn(async () => {
        throw new Error('should not be called');
      }),
    });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      onConsent: async () => false,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      {
        type: 'nosskey:request',
        id: 'v2',
        method: 'signEvent',
        params: { event: { kind: 1, content: '' } },
      },
      'https://parent.example'
    );

    const visibilityMessages = (
      parent.postMessage as unknown as ReturnType<typeof vi.fn>
    ).mock.calls
      .map((c) => c[0])
      .filter(isNosskeyVisibility);
    expect(visibilityMessages.map((m) => m.visible)).toEqual([true, false]);
    expect(manager.signEvent).not.toHaveBeenCalled();
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('USER_REJECTED');
    host.stop();
  });

  it('does not post visibility when signEvent fails with NO_KEY', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(win, 'parent', { value: parent, configurable: true });
    const manager = makeManager({ hasKeyInfo: () => false });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      onConsent: async () => true,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      {
        type: 'nosskey:request',
        id: 'v3',
        method: 'signEvent',
        params: { event: { kind: 1, content: '' } },
      },
      'https://parent.example'
    );

    const visibilityMessages = (
      parent.postMessage as unknown as ReturnType<typeof vi.fn>
    ).mock.calls
      .map((c) => c[0])
      .filter(isNosskeyVisibility);
    expect(visibilityMessages).toHaveLength(0);
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('NO_KEY');
    host.stop();
  });

  it('stop() removes the listener so subsequent messages are ignored', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager({ getPublicKey: vi.fn(async () => 'deadbeef') });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      window: win as unknown as Window,
    });
    host.start();
    host.stop();
    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r9', method: 'getPublicKey' },
      'https://parent.example'
    );
    expect(manager.getPublicKey).not.toHaveBeenCalled();
    expect(win.sent).toHaveLength(0);
  });

  it('throws when no Window is available', () => {
    vi.stubGlobal('window', undefined);
    try {
      expect(
        () =>
          new NosskeyIframeHost({
            manager: makeManager(),
          } as unknown as ConstructorParameters<typeof NosskeyIframeHost>[0])
      ).toThrow(/requires a Window/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('drops the reply when event.source is null', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager({ getPublicKey: vi.fn(async () => 'deadbeef') });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      onConsent: async () => true,
      window: win as unknown as Window,
    });
    host.start();
    await win.dispatchMessage(
      { type: 'nosskey:request', id: 's1', method: 'getPublicKey' },
      'https://parent.example',
      null
    );
    // Without a source Window there is nowhere to post the response.
    expect(win.sent).toHaveLength(0);
    host.stop();
  });
});
