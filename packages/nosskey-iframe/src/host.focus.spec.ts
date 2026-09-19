import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeHost } from './host.js';
import type { DispatchableWindow } from './host.test-helpers.js';
import { createFakeWindow, makeManager } from './host.test-helpers.js';

const ORIGIN = 'https://parent.example';

/**
 * 最小の document ダブル。`#focusForWebAuthn` が触るのは `hasFocus` /
 * `createElement` / `body.appendChild` だけ。
 */
function createFakeDocument(options: { focusedAfterWindowFocus?: boolean } = {}) {
  let focused = false;
  const created: { focus: ReturnType<typeof vi.fn>; removed: boolean }[] = [];
  const doc = {
    hasFocus: () => focused,
    createElement: () => {
      const el = {
        tabIndex: 0,
        style: { cssText: '' },
        isConnected: false,
        setAttribute: () => {},
        focus: vi.fn(() => {
          focused = true;
        }),
        remove() {
          entry.removed = true;
          el.isConnected = false;
        },
      };
      const entry = { focus: el.focus, removed: false };
      created.push(entry);
      return el as unknown as HTMLElement;
    },
    body: {
      appendChild: (el: { isConnected: boolean }) => {
        el.isConnected = true;
      },
    },
  };
  return {
    doc,
    created,
    setFocused: (value: boolean) => {
      focused = value;
    },
    onWindowFocus: () => {
      if (options.focusedAfterWindowFocus) focused = true;
    },
  };
}

describe('NosskeyIframeHost focus before WebAuthn', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  function makeHost(
    fake: ReturnType<typeof createFakeDocument>,
    overrides: Record<string, unknown> = {}
  ) {
    const win = createFakeWindow() as DispatchableWindow;
    const windowFocus = vi.fn(() => fake.onWindowFocus());
    Object.defineProperty(win, 'document', { value: fake.doc, configurable: true });
    Object.defineProperty(win, 'focus', { value: windowFocus, configurable: true });
    const host = new NosskeyIframeHost({
      manager: makeManager({
        getPublicKey: vi.fn(async () => 'pub'),
        signEvent: vi.fn(async (event) => event),
      }),
      allowedOrigins: [ORIGIN],
      requireUserConsent: false,
      window: win as unknown as Window,
      ...overrides,
    } as never);
    host.start();
    return { win, host, windowFocus };
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

  // 本題。WebKit は `credentials.get()` を「ドキュメントが未フォーカス」で拒否する。
  it('pulls focus into the document before an operation that derives the key', async () => {
    const fake = createFakeDocument();
    const { win, windowFocus } = makeHost(fake);

    await request(win, 'signEvent', signParams);

    expect(windowFocus).toHaveBeenCalled();
    expect(fake.created).toHaveLength(1);
    expect(fake.created[0].focus).toHaveBeenCalled();
    expect(fake.doc.hasFocus()).toBe(true);
  });

  // フォーカスを奪うのは鍵を導出する操作だけ。接続系で奪うと、親ページが
  // フォーカスしていた入力欄などから焦点をもぎ取ってしまう。
  it('leaves focus alone for getPublicKey and getRelays', async () => {
    const fake = createFakeDocument();
    const { win, windowFocus } = makeHost(fake, { onGetRelays: async () => ({}) });

    await request(win, 'getPublicKey');
    await request(win, 'getRelays');

    expect(windowFocus).not.toHaveBeenCalled();
    expect(fake.created).toHaveLength(0);
  });

  it('does nothing when the document already has focus', async () => {
    const fake = createFakeDocument();
    fake.setFocused(true);
    const { win, windowFocus } = makeHost(fake);

    await request(win, 'signEvent', signParams);

    expect(windowFocus).not.toHaveBeenCalled();
    expect(fake.created).toHaveLength(0);
  });

  // `window.focus()` で足りたならそれ以上触らない。
  it('skips the anchor when window.focus() was enough', async () => {
    const fake = createFakeDocument({ focusedAfterWindowFocus: true });
    const { win, windowFocus } = makeHost(fake);

    await request(win, 'signEvent', signParams);

    expect(windowFocus).toHaveBeenCalled();
    expect(fake.created).toHaveLength(0);
  });

  // フォーカスはあくまでヒント。取れなくても本来のエラーを返させる。
  it('still runs the operation when focusing throws', async () => {
    const fake = createFakeDocument();
    fake.doc.createElement = () => {
      throw new Error('no DOM for you');
    };
    const { win } = makeHost(fake);

    await request(win, 'signEvent', signParams);

    const response = win.sent.find(
      (entry) => (entry.data as { type?: string }).type === 'nosskey:response'
    );
    expect((response?.data as { error?: unknown } | undefined)?.error).toBeUndefined();
  });

  it('reuses one anchor across requests and drops it on stop()', async () => {
    const fake = createFakeDocument();
    const { win, host } = makeHost(fake);

    await request(win, 'signEvent', signParams);
    fake.setFocused(false);
    await request(win, 'signEvent', signParams);

    expect(fake.created).toHaveLength(1);

    host.stop();
    expect(fake.created[0].removed).toBe(true);
  });
});
