import type { NostrEvent } from 'nosskey-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeClient, NosskeyIframeError } from './client.js';

/**
 * Minimal DOM harness. We construct a fake window/document/container so the
 * iframe's `contentWindow` is under our control and we can intercept
 * `postMessage` calls and drive the client's message listener directly.
 */
interface FakeIframe {
  src: string;
  style: { display: string };
  attributes: Record<string, string>;
  contentWindow: { postMessage: ReturnType<typeof vi.fn> };
  parentNode: FakeElement | null;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

interface FakeElement {
  children: FakeIframe[];
  appendChild(node: FakeIframe): FakeIframe;
  removeChild(node: FakeIframe): FakeIframe;
}

interface Harness {
  window: Window;
  document: Document;
  container: FakeElement;
  dispatch: (data: unknown, origin: string, source?: unknown) => void;
  dispatchAsIframe: (data: unknown, origin?: string) => void;
  iframes: FakeIframe[];
}

function createHarness(iframeOrigin = 'https://nosskey.example'): Harness {
  const listeners: Array<(event: MessageEvent) => void> = [];
  const iframes: FakeIframe[] = [];

  const createElement = (tagName: string) => {
    if (tagName !== 'iframe') {
      throw new Error(`Unexpected createElement(${tagName})`);
    }
    const iframe: FakeIframe = {
      src: '',
      style: { display: '' },
      attributes: {},
      contentWindow: { postMessage: vi.fn() },
      parentNode: null,
      setAttribute(name, value) {
        iframe.attributes[name] = value;
      },
      getAttribute(name) {
        return iframe.attributes[name] ?? null;
      },
    };
    iframes.push(iframe);
    return iframe;
  };

  const container: FakeElement = {
    children: [],
    appendChild(node) {
      container.children.push(node);
      node.parentNode = container;
      return node;
    },
    removeChild(node) {
      const idx = container.children.indexOf(node);
      if (idx >= 0) container.children.splice(idx, 1);
      node.parentNode = null;
      return node;
    },
  };

  const doc = {
    createElement,
    get body() {
      return container;
    },
  } as unknown as Document;

  const win = {
    addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (type !== 'message') return;
      listeners.push(handler as (event: MessageEvent) => void);
    },
    removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (type !== 'message') return;
      const idx = listeners.indexOf(handler as (event: MessageEvent) => void);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    document: doc,
    location: { href: 'https://parent.example/app/' },
    crypto: {
      randomUUID: (() => {
        let n = 0;
        return () => `test-id-${++n}`;
      })(),
    },
  } as unknown as Window;

  const dispatch = (data: unknown, origin: string, source?: unknown) => {
    const event = { data, origin, source } as unknown as MessageEvent;
    for (const handler of [...listeners]) {
      handler(event);
    }
  };

  const dispatchAsIframe = (data: unknown, origin = iframeOrigin) => {
    const iframe = iframes[0];
    if (!iframe) throw new Error('No iframe created yet.');
    dispatch(data, origin, iframe.contentWindow);
  };

  return { window: win, document: doc, container, dispatch, dispatchAsIframe, iframes };
}

describe('NosskeyIframeClient', () => {
  let harness: Harness;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts an iframe with the WebAuthn allow attribute and hidden style', () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });

    expect(harness.iframes).toHaveLength(1);
    const iframe = harness.iframes[0];
    expect(iframe.src).toBe('https://nosskey.example/iframe');
    expect(iframe.getAttribute('allow')).toBe(
      'publickey-credentials-get; publickey-credentials-create'
    );
    expect(iframe.style.display).toBe('none');
    expect(iframe.parentNode).toBe(harness.container);
    client.destroy();
  });

  it('ready() resolves when a nosskey:ready message arrives from the iframe', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });

    const readyPromise = client.ready();
    harness.dispatchAsIframe({ type: 'nosskey:ready' });
    await expect(readyPromise).resolves.toBeUndefined();
    client.destroy();
  });

  it('getPublicKey() posts a request and resolves with the response result', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    const iframe = harness.iframes[0];

    const pending = client.getPublicKey();
    expect(iframe.contentWindow.postMessage).toHaveBeenCalledOnce();
    const [request, targetOrigin] = iframe.contentWindow.postMessage.mock.calls[0];
    expect(targetOrigin).toBe('https://nosskey.example');
    expect(request).toMatchObject({
      type: 'nosskey:request',
      method: 'getPublicKey',
      id: 'test-id-1',
    });

    harness.dispatchAsIframe({ type: 'nosskey:response', id: 'test-id-1', result: 'deadbeef' });
    await expect(pending).resolves.toBe('deadbeef');
    client.destroy();
  });

  it('signEvent() posts the event and resolves with the signed event', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    const iframe = harness.iframes[0];
    const unsigned: NostrEvent = { kind: 1, content: 'hi' };
    const signed: NostrEvent = { ...unsigned, id: 'abc', sig: 'def' };

    const pending = client.signEvent(unsigned);
    const [request] = iframe.contentWindow.postMessage.mock.calls[0];
    expect(request).toMatchObject({
      type: 'nosskey:request',
      method: 'signEvent',
      params: { event: unsigned },
    });

    harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: signed });
    await expect(pending).resolves.toEqual(signed);
    client.destroy();
  });

  it('rejects with NosskeyIframeError when the response carries an error', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    const pending = client.getPublicKey();
    const iframe = harness.iframes[0];
    const [request] = iframe.contentWindow.postMessage.mock.calls[0];

    harness.dispatchAsIframe({
      type: 'nosskey:response',
      id: request.id,
      error: { code: 'USER_REJECTED', message: 'nope' },
    });

    await expect(pending).rejects.toBeInstanceOf(NosskeyIframeError);
    await expect(pending).rejects.toMatchObject({ code: 'USER_REJECTED', message: 'nope' });
    client.destroy();
  });

  it('rejects after timeout when no response arrives', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
      timeout: 50,
    });
    const pending = client.getPublicKey();
    // Attach a catch handler immediately so the rejection is not treated as unhandled
    // before the test assertion runs.
    const settled = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(60);
    await settled;
    client.destroy();
  });

  it('ignores messages whose source is not the iframe', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    const pending = client.getPublicKey();
    const iframe = harness.iframes[0];
    const [request] = iframe.contentWindow.postMessage.mock.calls[0];

    // Unrelated window sends a matching response — must be ignored.
    harness.dispatch(
      { type: 'nosskey:response', id: request.id, result: 'fake' },
      'https://nosskey.example',
      { unrelated: true }
    );

    // Subsequently, the real iframe replies and the promise resolves.
    harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: 'real' });
    await expect(pending).resolves.toBe('real');
    client.destroy();
  });

  it('ignores messages whose origin does not match the iframe origin', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    const pending = client.getPublicKey();
    const iframe = harness.iframes[0];
    const [request] = iframe.contentWindow.postMessage.mock.calls[0];

    harness.dispatch(
      { type: 'nosskey:response', id: request.id, result: 'spoof' },
      'https://evil.example',
      iframe.contentWindow
    );

    harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: 'legit' });
    await expect(pending).resolves.toBe('legit');
    client.destroy();
  });

  it('destroy() removes the iframe, detaches the listener, and rejects pending requests', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    const iframe = harness.iframes[0];
    const pending = client.getPublicKey();
    const settled = expect(pending).rejects.toThrow(/destroyed/);

    client.destroy();
    await settled;

    expect(harness.container.children).not.toContain(iframe);

    // Post-destroy: further messages must not resolve anything.
    harness.dispatchAsIframe({ type: 'nosskey:response', id: 'test-id-1', result: 'late' });
    // No assertion needed — absence of unhandled rejections is the check.
  });

  it('request rejects when the iframe has no contentWindow', async () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    // Simulate a not-yet-loaded iframe.
    (harness.iframes[0] as unknown as { contentWindow: null }).contentWindow = null;
    await expect(client.getPublicKey()).rejects.toThrow(/not ready/);
    client.destroy();
  });
});
