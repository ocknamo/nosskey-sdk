import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeHost } from './host.js';
import { createFakeWindow, makeManager } from './host.test-helpers.js';
import type { DispatchableWindow } from './host.test-helpers.js';
import { isNosskeyReady, isNosskeyResponse, isNosskeyVisibility } from './protocol.js';
import type { NostrEvent } from './types.js';

describe('NosskeyIframeHost', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('emits nosskey:ready to parent on start()', () => {
    const win = createFakeWindow();
    // Make parent a different Window so the ready is posted there.
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(win, 'parent', { value: parent, configurable: true });
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: ['https://parent.example'],
      window: win as unknown as Window,
    });
    host.start();
    expect((parent.postMessage as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    const [readyMsg] = (parent.postMessage as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(isNosskeyReady(readyMsg)).toBe(true);
    host.stop();
  });

  it('warns when allowedOrigins is "*"', () => {
    const win = createFakeWindow();
    new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: '*',
      window: win as unknown as Window,
    }).start();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('throws when allowedOrigins is omitted (no silent open default)', () => {
    const win = createFakeWindow();
    expect(
      () =>
        new NosskeyIframeHost({
          manager: makeManager(),
          window: win as unknown as Window,
        } as unknown as ConstructorParameters<typeof NosskeyIframeHost>[0])
    ).toThrow(/allowedOrigins/);
  });

  it('routes getPublicKey after onConsent resolves true', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const onConsent = vi.fn(async () => true);
    const manager = makeManager({
      getPublicKey: vi.fn(async () => 'deadbeef'),
    });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      onConsent,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r1', method: 'getPublicKey' },
      'https://parent.example'
    );

    expect(onConsent).toHaveBeenCalledWith({
      origin: 'https://parent.example',
      method: 'getPublicKey',
    });
    expect(manager.getPublicKey).toHaveBeenCalledOnce();
    expect(win.sent).toHaveLength(1);
    const msg = win.sent[0];
    expect(isNosskeyResponse(msg.data)).toBe(true);
    expect((msg.data as { result: unknown }).result).toBe('deadbeef');
    expect(msg.targetOrigin).toBe('https://parent.example');
    host.stop();
  });

  it('returns USER_REJECTED for getPublicKey when consent is denied', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager({
      getPublicKey: vi.fn(async () => {
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
      { type: 'nosskey:request', id: 'r1d', method: 'getPublicKey' },
      'https://parent.example'
    );

    expect(manager.getPublicKey).not.toHaveBeenCalled();
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('USER_REJECTED');
    host.stop();
  });

  it('returns INTERNAL for getPublicKey when onConsent is missing (fail-closed default)', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager({ getPublicKey: vi.fn(async () => 'deadbeef') });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      // onConsent intentionally omitted while requireUserConsent defaults to true
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r1i', method: 'getPublicKey' },
      'https://parent.example'
    );

    expect(manager.getPublicKey).not.toHaveBeenCalled();
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('INTERNAL');
    host.stop();
  });

  it('serves getPublicKey silently when requireUserConsent is false (explicit opt-out)', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager({ getPublicKey: vi.fn(async () => 'deadbeef') });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      requireUserConsent: false,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r1s', method: 'getPublicKey' },
      'https://parent.example'
    );

    expect((win.sent[0].data as { result: unknown }).result).toBe('deadbeef');
    host.stop();
  });

  it('posts visibility true/false around a consented getPublicKey', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(win, 'parent', { value: parent, configurable: true });
    const manager = makeManager({ getPublicKey: vi.fn(async () => 'deadbeef') });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      onConsent: async () => true,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r1v', method: 'getPublicKey' },
      'https://parent.example'
    );

    const visibilityMessages = (
      parent.postMessage as unknown as ReturnType<typeof vi.fn>
    ).mock.calls
      .map((c) => c[0])
      .filter(isNosskeyVisibility);
    expect(visibilityMessages.map((m) => m.visible)).toEqual([true, false]);
    host.stop();
  });

  it('does not post visibility when getPublicKey fails with NO_KEY', async () => {
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
      { type: 'nosskey:request', id: 'r1n', method: 'getPublicKey' },
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

  it('routes getRelays via onGetRelays after onConsent resolves true', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const relays = {
      'wss://relay.example': { read: true, write: true },
      'wss://relay.read.example': { read: true, write: false },
    };
    const onGetRelays = vi.fn(async () => relays);
    const onConsent = vi.fn(async () => true);
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: ['https://parent.example'],
      onConsent,
      onGetRelays,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'rg1', method: 'getRelays' },
      'https://parent.example'
    );

    expect(onConsent).toHaveBeenCalledWith({
      origin: 'https://parent.example',
      method: 'getRelays',
    });
    expect(onGetRelays).toHaveBeenCalledOnce();
    expect(win.sent).toHaveLength(1);
    const msg = win.sent[0];
    expect(isNosskeyResponse(msg.data)).toBe(true);
    expect((msg.data as { result: unknown }).result).toEqual(relays);
    expect(msg.targetOrigin).toBe('https://parent.example');
    host.stop();
  });

  it('returns USER_REJECTED for getRelays when consent is denied', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const onGetRelays = vi.fn(async () => ({}));
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: ['https://parent.example'],
      onConsent: async () => false,
      onGetRelays,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'rg1d', method: 'getRelays' },
      'https://parent.example'
    );

    expect(onGetRelays).not.toHaveBeenCalled();
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('USER_REJECTED');
    host.stop();
  });

  it('returns an empty map for getRelays without consent when onGetRelays is not provided', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const onConsent = vi.fn(async () => true);
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: ['https://parent.example'],
      onConsent,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'rg2', method: 'getRelays' },
      'https://parent.example'
    );

    expect(onConsent).not.toHaveBeenCalled();
    expect(win.sent).toHaveLength(1);
    expect((win.sent[0].data as { result: unknown }).result).toEqual({});
    host.stop();
  });

  it('returns an empty map for getRelays without consent when no key is configured', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const onConsent = vi.fn(async () => true);
    const onGetRelays = vi.fn(async () => ({
      'wss://relay.example': { read: true, write: true },
    }));
    const host = new NosskeyIframeHost({
      manager: makeManager({ hasKeyInfo: () => false }),
      allowedOrigins: ['https://parent.example'],
      onConsent,
      onGetRelays,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'rg3', method: 'getRelays' },
      'https://parent.example'
    );

    expect(onConsent).not.toHaveBeenCalled();
    expect(onGetRelays).not.toHaveBeenCalled();
    expect((win.sent[0].data as { result: unknown }).result).toEqual({});
    host.stop();
  });

  it('routes signEvent after onConsent resolves true', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const input: NostrEvent = { kind: 1, content: 'hi' };
    const signed: NostrEvent = { ...input, id: 'abc', sig: 'def' };
    const onConsent = vi.fn(async () => true);
    const manager = makeManager({
      signEvent: vi.fn(async () => signed),
    });
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
        id: 'r2',
        method: 'signEvent',
        params: { event: input },
      },
      'https://parent.example'
    );

    expect(onConsent).toHaveBeenCalledWith({
      origin: 'https://parent.example',
      method: 'signEvent',
      event: input,
    });
    expect(manager.signEvent).toHaveBeenCalledWith(input);
    const [msg] = win.sent;
    expect((msg.data as { result: NostrEvent }).result).toEqual(signed);
    host.stop();
  });

  it('returns USER_REJECTED when onConsent resolves false', async () => {
    const win = createFakeWindow() as DispatchableWindow;
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
        id: 'r3',
        method: 'signEvent',
        params: { event: { kind: 1, content: '' } },
      },
      'https://parent.example'
    );
    expect(manager.signEvent).not.toHaveBeenCalled();
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('USER_REJECTED');
    host.stop();
  });

  it('returns NO_KEY when manager.hasKeyInfo() is false', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager({ hasKeyInfo: () => false });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      window: win as unknown as Window,
    });
    host.start();
    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r4', method: 'getPublicKey' },
      'https://parent.example'
    );
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('NO_KEY');
    host.stop();
  });

  it('returns INVALID_REQUEST when signEvent is missing params.event', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: ['https://parent.example'],
      onConsent: async () => true,
      window: win as unknown as Window,
    });
    host.start();
    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r5', method: 'signEvent' },
      'https://parent.example'
    );
    expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
    host.stop();
  });
});
