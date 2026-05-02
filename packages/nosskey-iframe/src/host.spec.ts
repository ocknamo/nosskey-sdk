import type { NosskeyManagerLike, NostrEvent } from 'nosskey-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeHost } from './host.js';
import { isNosskeyReady, isNosskeyResponse, isNosskeyVisibility } from './protocol.js';

/**
 * Builds a `NosskeyManagerLike` test double where every method is a vitest spy
 * that throws by default. Overrides provided via `overrides` win.
 */
function makeManager(overrides: Partial<NosskeyManagerLike> = {}): NosskeyManagerLike {
  const unimplemented = (name: string) =>
    vi.fn(async () => {
      throw new Error(`unexpected call: ${name}`);
    });
  const base: NosskeyManagerLike = {
    getPublicKey: unimplemented('getPublicKey'),
    signEvent: unimplemented('signEvent'),
    setCurrentKeyInfo: vi.fn(),
    getCurrentKeyInfo: vi.fn(() => null),
    hasKeyInfo: vi.fn(() => true),
    setStorageOptions: vi.fn(),
    getStorageOptions: vi.fn(() => ({ enabled: true })),
    clearStoredKeyInfo: vi.fn(),
    isPrfSupported: unimplemented('isPrfSupported'),
    createPasskey: unimplemented('createPasskey'),
    createNostrKey: unimplemented('createNostrKey'),
    signEventWithKeyInfo: unimplemented('signEventWithKeyInfo'),
    setCacheOptions: vi.fn(),
    getCacheOptions: vi.fn(() => ({ enabled: false })),
    clearCachedKey: vi.fn(),
    clearAllCachedKeys: vi.fn(),
    exportNostrKey: unimplemented('exportNostrKey'),
    nip44Encrypt: unimplemented('nip44Encrypt'),
    nip44Decrypt: unimplemented('nip44Decrypt'),
    nip04Encrypt: unimplemented('nip04Encrypt'),
    nip04Decrypt: unimplemented('nip04Decrypt'),
  };
  return { ...base, ...overrides };
}

/**
 * Minimal fake Window that records posted messages and supports
 * add/removeEventListener for 'message'. The host's postMessage to
 * `window.parent` and to `event.source` ends up in the `sent` array.
 */
interface FakeWindow extends Partial<Window> {
  addEventListener: Window['addEventListener'];
  removeEventListener: Window['removeEventListener'];
  postMessage: (data: unknown, targetOrigin?: string | { targetOrigin: string }) => void;
  parent: Window;
  sent: Array<{ data: unknown; targetOrigin: string }>;
}

function createFakeWindow(): FakeWindow {
  const listeners: Array<(event: MessageEvent) => void> = [];
  const sent: Array<{ data: unknown; targetOrigin: string }> = [];
  const win = {
    sent,
    addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (type !== 'message') return;
      listeners.push(handler as (event: MessageEvent) => void);
    },
    removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (type !== 'message') return;
      const idx = listeners.indexOf(handler as (event: MessageEvent) => void);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    postMessage(data: unknown, targetOrigin: string | { targetOrigin: string } = '*') {
      const origin = typeof targetOrigin === 'string' ? targetOrigin : targetOrigin.targetOrigin;
      sent.push({ data, targetOrigin: origin });
    },
    get parent(): Window {
      return win as unknown as Window;
    },
  } as unknown as FakeWindow & {
    dispatchMessage: (data: unknown, origin: string, source?: Window | null) => Promise<void>;
  };

  // Helper used by tests to drive the listener synchronously but wait for
  // asynchronous handlers to resolve. We expose it via a property.
  (
    win as unknown as {
      dispatchMessage: (data: unknown, origin: string, source?: Window | null) => Promise<void>;
    }
  ).dispatchMessage = async (data, origin, source) => {
    const event = {
      data,
      origin,
      source: source === undefined ? (win as unknown as Window) : source,
    } as unknown as MessageEvent;
    for (const handler of [...listeners]) {
      await handler(event);
    }
  };

  return win as unknown as FakeWindow;
}

type DispatchableWindow = FakeWindow & {
  dispatchMessage: (data: unknown, origin: string, source?: Window | null) => Promise<void>;
};

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
      window: win as unknown as Window,
    }).start();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('routes getPublicKey and returns the manager result', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const manager = makeManager({
      getPublicKey: vi.fn(async () => 'deadbeef'),
    });
    const host = new NosskeyIframeHost({
      manager,
      allowedOrigins: ['https://parent.example'],
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'r1', method: 'getPublicKey' },
      'https://parent.example'
    );

    expect(manager.getPublicKey).toHaveBeenCalledOnce();
    expect(win.sent).toHaveLength(1);
    const msg = win.sent[0];
    expect(isNosskeyResponse(msg.data)).toBe(true);
    expect((msg.data as { result: unknown }).result).toBe('deadbeef');
    expect(msg.targetOrigin).toBe('https://parent.example');
    host.stop();
  });

  it('routes getRelays via the onGetRelays callback', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const relays = {
      'wss://relay.example': { read: true, write: true },
      'wss://relay.read.example': { read: true, write: false },
    };
    const onGetRelays = vi.fn(async () => relays);
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: ['https://parent.example'],
      onGetRelays,
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'rg1', method: 'getRelays' },
      'https://parent.example'
    );

    expect(onGetRelays).toHaveBeenCalledOnce();
    expect(win.sent).toHaveLength(1);
    const msg = win.sent[0];
    expect(isNosskeyResponse(msg.data)).toBe(true);
    expect((msg.data as { result: unknown }).result).toEqual(relays);
    expect(msg.targetOrigin).toBe('https://parent.example');
    host.stop();
  });

  it('returns an empty map for getRelays when onGetRelays is not provided', async () => {
    const win = createFakeWindow() as DispatchableWindow;
    const host = new NosskeyIframeHost({
      manager: makeManager(),
      allowedOrigins: ['https://parent.example'],
      window: win as unknown as Window,
    });
    host.start();

    await win.dispatchMessage(
      { type: 'nosskey:request', id: 'rg2', method: 'getRelays' },
      'https://parent.example'
    );

    expect(win.sent).toHaveLength(1);
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

  describe('nip44 / nip04 encrypt / decrypt', () => {
    const peerPub = 'a'.repeat(64);

    it('routes nip44_encrypt after consent and exposes plaintext to the dialog', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const onConsent = vi.fn(async () => true);
      const manager = makeManager({
        nip44Encrypt: vi.fn(async () => 'cipher-text-payload'),
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
          id: 'n1',
          method: 'nip44_encrypt',
          params: { pubkey: peerPub, plaintext: 'secret' },
        },
        'https://parent.example'
      );
      expect(onConsent).toHaveBeenCalledWith({
        origin: 'https://parent.example',
        method: 'nip44_encrypt',
        pubkey: peerPub,
        plaintext: 'secret',
      });
      expect(manager.nip44Encrypt).toHaveBeenCalledWith(peerPub, 'secret');
      expect((win.sent[0].data as { result: string }).result).toBe('cipher-text-payload');
      host.stop();
    });

    it('omits plaintext from consent for nip44_decrypt', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const onConsent = vi.fn(async () => true);
      const manager = makeManager({
        nip44Decrypt: vi.fn(async () => 'decrypted'),
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
          id: 'n2',
          method: 'nip44_decrypt',
          params: { pubkey: peerPub, ciphertext: 'cipher' },
        },
        'https://parent.example'
      );
      const consentArg = onConsent.mock.calls[0][0];
      expect(consentArg.method).toBe('nip44_decrypt');
      expect(consentArg.pubkey).toBe(peerPub);
      expect(consentArg).not.toHaveProperty('plaintext');
      expect(manager.nip44Decrypt).toHaveBeenCalledWith(peerPub, 'cipher');
      host.stop();
    });

    it('routes nip04_encrypt and nip04_decrypt', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const manager = makeManager({
        nip04Encrypt: vi.fn(async () => 'cbc?iv=zz'),
        nip04Decrypt: vi.fn(async () => 'plain'),
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
          id: 'n3',
          method: 'nip04_encrypt',
          params: { pubkey: peerPub, plaintext: 'hi' },
        },
        'https://parent.example'
      );
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id: 'n4',
          method: 'nip04_decrypt',
          params: { pubkey: peerPub, ciphertext: 'cbc?iv=zz' },
        },
        'https://parent.example'
      );
      expect(manager.nip04Encrypt).toHaveBeenCalledWith(peerPub, 'hi');
      expect(manager.nip04Decrypt).toHaveBeenCalledWith(peerPub, 'cbc?iv=zz');
      const results = win.sent
        .filter((m) => 'data' in m && (m.data as { type: string }).type === 'nosskey:response')
        .map((m) => (m.data as { result?: string }).result);
      expect(results).toContain('cbc?iv=zz');
      expect(results).toContain('plain');
      host.stop();
    });

    it('returns USER_REJECTED for nip44_encrypt when consent is denied', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const manager = makeManager({
        nip44Encrypt: vi.fn(async () => {
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
          id: 'n5',
          method: 'nip44_encrypt',
          params: { pubkey: peerPub, plaintext: 'x' },
        },
        'https://parent.example'
      );
      expect(manager.nip44Encrypt).not.toHaveBeenCalled();
      expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('USER_REJECTED');
      host.stop();
    });

    it('returns INVALID_REQUEST when params are missing', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const manager = makeManager();
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: ['https://parent.example'],
        onConsent: async () => true,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        { type: 'nosskey:request', id: 'n6', method: 'nip44_encrypt' },
        'https://parent.example'
      );
      expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
      host.stop();
    });
  });
});
