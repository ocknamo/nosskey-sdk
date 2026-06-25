import { vi } from 'vitest';
import type { NosskeyManagerLike } from './types.js';

/**
 * host.*.spec.ts（機能ごとに分割した複数ファイル）が共有するテスト用ヘルパー。
 * 元は単一 spec の冒頭に直書きされていたモックビルダー / FakeWindow を、
 * ファイル分割に伴い共通化したもの。挙動は分割前と同一。
 */

/**
 * Builds a `NosskeyManagerLike` test double where every method is a vitest spy
 * that throws by default. Overrides provided via `overrides` win.
 */
export function makeManager(overrides: Partial<NosskeyManagerLike> = {}): NosskeyManagerLike {
  const unimplemented = (name: string) =>
    vi.fn(async () => {
      throw new Error(`unexpected call: ${name}`);
    });
  const base: NosskeyManagerLike = {
    hasKeyInfo: vi.fn(() => true),
    getPublicKey: unimplemented('getPublicKey'),
    signEvent: unimplemented('signEvent'),
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
export interface FakeWindow extends Partial<Window> {
  addEventListener: Window['addEventListener'];
  removeEventListener: Window['removeEventListener'];
  postMessage: (data: unknown, targetOrigin?: string | { targetOrigin: string }) => void;
  parent: Window;
  sent: Array<{ data: unknown; targetOrigin: string }>;
}

export function createFakeWindow(): FakeWindow {
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

export type DispatchableWindow = FakeWindow & {
  dispatchMessage: (data: unknown, origin: string, source?: Window | null) => Promise<void>;
};
