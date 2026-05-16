import type { NostrEvent } from 'nosskey-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PUBLISH_ACK_TIMEOUT_MS, publishEvent } from './relay.js';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  static throwOnConstruct: Error | null = null;

  readonly url: string;
  sent: string[] = [];
  closeCalled = 0;

  constructor(url: string) {
    super();
    if (FakeWebSocket.throwOnConstruct) throw FakeWebSocket.throwOnConstruct;
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closeCalled += 1;
  }

  triggerOpen(): void {
    this.dispatchEvent(new Event('open'));
  }

  triggerMessage(data: string | ArrayBuffer): void {
    const event = new Event('message') as Event & { data: string | ArrayBuffer };
    event.data = data;
    this.dispatchEvent(event);
  }

  triggerError(): void {
    this.dispatchEvent(new Event('error'));
  }

  triggerClose(): void {
    this.dispatchEvent(new Event('close'));
  }
}

const fakeWebSocket = FakeWebSocket as unknown as typeof WebSocket;

const SIGNED_EVENT: NostrEvent = {
  kind: 1,
  content: 'hi',
  tags: [],
  created_at: 1700000000,
  pubkey: 'p'.repeat(64),
  id: 'i'.repeat(64),
  sig: 's'.repeat(128),
};

beforeEach(() => {
  FakeWebSocket.instances = [];
  FakeWebSocket.throwOnConstruct = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('publishEvent', () => {
  it('sends ["EVENT", signed] on open', async () => {
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    expect(ws).toBeDefined();
    ws.triggerOpen();
    expect(ws.sent).toEqual([JSON.stringify(['EVENT', SIGNED_EVENT])]);
    // settle so the promise doesn't dangle
    ws.triggerMessage(JSON.stringify(['OK', SIGNED_EVENT.id, true, '']));
    await promise;
    expect(ws.closeCalled).toBe(1);
  });

  it('resolves on first OK frame and closes the socket', async () => {
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    ws.triggerMessage(JSON.stringify(['OK', SIGNED_EVENT.id, true, '']));
    await expect(promise).resolves.toBeUndefined();
    expect(ws.closeCalled).toBe(1);
  });

  it('resolves on NOTICE frame as well', async () => {
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    ws.triggerMessage(JSON.stringify(['NOTICE', 'rate limited']));
    await expect(promise).resolves.toBeUndefined();
  });

  it('ignores binary frames and keeps waiting', async () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      timeoutMs: 1000,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    ws.triggerMessage(new ArrayBuffer(4));
    // Binary frame must be logged but not settle the promise.
    expect(log).toHaveBeenCalledWith(expect.stringContaining('<binary>'));
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no OK/NOTICE within 1000ms'));
  });

  it('resolves after timeout with a logged message and closes the socket', async () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      timeoutMs: 500,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    vi.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
    expect(ws.closeCalled).toBe(1);
    expect(log).toHaveBeenCalledWith('Relay wss://example: no OK/NOTICE within 500ms, closing.');
  });

  it('uses DEFAULT_PUBLISH_ACK_TIMEOUT_MS when no timeoutMs is provided', async () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      webSocketImpl: fakeWebSocket,
    });
    vi.advanceTimersByTime(DEFAULT_PUBLISH_ACK_TIMEOUT_MS);
    await expect(promise).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`within ${DEFAULT_PUBLISH_ACK_TIMEOUT_MS}ms`)
    );
  });

  it('rejects on socket error before settle', async () => {
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    ws.triggerError();
    await expect(promise).rejects.toThrow('WebSocket error for wss://example');
  });

  it('resolves on close event when never settled', async () => {
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    ws.triggerClose();
    await expect(promise).resolves.toBeUndefined();
  });

  it('ignores duplicate close/error events after the first OK', async () => {
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    ws.triggerMessage(JSON.stringify(['OK', SIGNED_EVENT.id, true, '']));
    await promise;
    expect(ws.closeCalled).toBe(1);
    // Subsequent events must not throw or re-resolve.
    expect(() => {
      ws.triggerError();
      ws.triggerClose();
    }).not.toThrow();
    expect(ws.closeCalled).toBe(1);
  });

  it('ignores non-JSON text frames', async () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const promise = publishEvent('wss://example', SIGNED_EVENT, {
      log,
      timeoutMs: 100,
      webSocketImpl: fakeWebSocket,
    });
    const ws = FakeWebSocket.instances[0];
    ws.triggerMessage('not json at all');
    expect(log).toHaveBeenCalledWith('Relay wss://example: not json at all');
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects if the WebSocket constructor throws synchronously', async () => {
    const log = vi.fn();
    FakeWebSocket.throwOnConstruct = new Error('bad url');
    await expect(
      publishEvent('wss://example', SIGNED_EVENT, {
        log,
        webSocketImpl: fakeWebSocket,
      })
    ).rejects.toThrow('bad url');
  });
});
