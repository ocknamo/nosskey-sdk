import { vi } from 'vitest';

/**
 * Minimal DOM harness. We construct a fake window/document/container so the
 * iframe's `contentWindow` is under our control and we can intercept
 * `postMessage` calls and drive the client's message listener directly.
 */
export interface FakeIframe {
  src: string;
  style: { display: string };
  attributes: Record<string, string>;
  contentWindow: { postMessage: ReturnType<typeof vi.fn> };
  parentNode: FakeElement | null;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
}

export interface FakeElement {
  children: FakeIframe[];
  appendChild(node: FakeIframe): FakeIframe;
  removeChild(node: FakeIframe): FakeIframe;
}

export interface Harness {
  window: Window;
  document: Document;
  container: FakeElement;
  dispatch: (data: unknown, origin: string, source?: unknown) => void;
  dispatchAsIframe: (data: unknown, origin?: string) => void;
  iframes: FakeIframe[];
}

export function createHarness(iframeOrigin = 'https://nosskey.example'): Harness {
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
      removeAttribute(name) {
        delete iframe.attributes[name];
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
