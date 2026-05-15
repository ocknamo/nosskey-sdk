/**
 * NosskeyIframeClient — parent-page helper that mounts the Nosskey signing
 * iframe and bridges NIP-07 requests across {@link Window.postMessage}.
 *
 * @packageDocumentation
 */
import type { NostrEvent } from 'nosskey-sdk';
import {
  type NosskeyRequest,
  type NosskeyResponse,
  type RelayMap,
  isNosskeyReady,
  isNosskeyResponse,
  isNosskeyVisibility,
} from './protocol.js';

/** WebAuthn permission policy required for the iframe to use passkeys. */
const IFRAME_ALLOW = 'publickey-credentials-get; publickey-credentials-create';

export interface NosskeyIframeClientOptions {
  /** Absolute URL of the Nosskey iframe (e.g. `https://nosskey.app/#/iframe`). */
  iframeUrl: string;
  /** Where to append the iframe element. Defaults to `document.body`. */
  container?: HTMLElement;
  /** Request timeout in milliseconds. Defaults to 60000. */
  timeout?: number;
  /**
   * Theme to pass to the iframe via the `?theme=...` URL parameter. When set,
   * `embedded=1` is also appended automatically. The host app applies the
   * theme on load only; runtime switching requires destroying and re-creating
   * the client with a new value.
   */
  theme?: 'light' | 'dark' | 'auto';
  /**
   * Language to pass to the iframe via the `?lang=...` URL parameter. When
   * set, `embedded=1` is also appended automatically. Same load-time-only
   * semantics as {@link theme}.
   */
  lang?: 'ja' | 'en';
  /**
   * Override the window used to install the message listener.
   * Defaults to `globalThis.window`. Primarily useful for tests.
   */
  window?: Window;
  /** Override `document` for iframe creation. Primarily useful for tests. */
  document?: Document;
}

interface ResolvedOptions {
  iframeUrl: string;
  iframeOrigin: string;
  container: HTMLElement;
  timeout: number;
  window: Window;
  document: Document;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

function buildIframeUrl(
  rawUrl: string,
  baseHref: string,
  theme: NosskeyIframeClientOptions['theme'],
  lang: NosskeyIframeClientOptions['lang']
): string {
  if (theme === undefined && lang === undefined) {
    return rawUrl;
  }
  try {
    const url = new URL(rawUrl, baseHref);
    url.searchParams.set('embedded', '1');
    if (theme !== undefined) {
      url.searchParams.set('theme', theme);
    }
    if (lang !== undefined) {
      url.searchParams.set('lang', lang);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function resolveOptions(options: NosskeyIframeClientOptions): ResolvedOptions {
  const win = options.window ?? (globalThis as unknown as { window?: Window }).window;
  if (!win) {
    throw new Error('NosskeyIframeClient requires a Window (provide options.window).');
  }
  const doc = options.document ?? win.document;
  if (!doc) {
    throw new Error('NosskeyIframeClient requires a Document (provide options.document).');
  }
  const container = options.container ?? doc.body;
  if (!container) {
    throw new Error('NosskeyIframeClient could not determine a container element.');
  }
  const baseHref = win.location?.href ?? 'http://localhost/';
  const iframeUrl = buildIframeUrl(options.iframeUrl, baseHref, options.theme, options.lang);
  const iframeOrigin = new URL(iframeUrl, baseHref).origin;
  return {
    iframeUrl,
    iframeOrigin,
    container,
    timeout: options.timeout ?? 60000,
    window: win,
    document: doc,
  };
}

function makeId(win: Window): string {
  const cryptoObj = (win as unknown as { crypto?: Crypto }).crypto ?? globalThis.crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  // Deterministic but unique-enough fallback used only when crypto.randomUUID is absent.
  return `nosskey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Parent-page façade over the Nosskey iframe. Call {@link ready} once, then
 * {@link getPublicKey} / {@link signEvent}. Call {@link destroy} when done.
 */
export class NosskeyIframeClient {
  readonly #options: ResolvedOptions;
  readonly #iframe: HTMLIFrameElement;
  readonly #pending = new Map<string, Pending>();
  readonly #listener: (event: MessageEvent) => void;
  #readyResolve: (() => void) | null = null;
  #readyReject: ((reason: unknown) => void) | null = null;
  readonly #readyPromise: Promise<void>;
  #isReady = false;
  #destroyed = false;

  constructor(options: NosskeyIframeClientOptions) {
    this.#options = resolveOptions(options);

    const iframe = this.#options.document.createElement('iframe');
    iframe.src = this.#options.iframeUrl;
    iframe.setAttribute('allow', IFRAME_ALLOW);
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'Nosskey signing iframe');
    this.#options.container.appendChild(iframe);
    this.#iframe = iframe;

    this.#readyPromise = new Promise<void>((resolve, reject) => {
      this.#readyResolve = resolve;
      this.#readyReject = reject;
    });
    // Attach a no-op handler so "destroyed before ready" rejections don't
    // surface as unhandled for callers who never await ready().
    this.#readyPromise.catch(() => undefined);

    this.#listener = (event: MessageEvent) => this.#handleMessage(event);
    this.#options.window.addEventListener('message', this.#listener);
  }

  /** The underlying iframe element (exposed for styling/visibility control). */
  get iframe(): HTMLIFrameElement {
    return this.#iframe;
  }

  /** Resolves when the iframe has signalled `nosskey:ready`. */
  ready(): Promise<void> {
    return this.#readyPromise;
  }

  /** Send a `getPublicKey` request and await the response. */
  async getPublicKey(): Promise<string> {
    const result = await this.#request({ method: 'getPublicKey' });
    if (typeof result !== 'string') {
      throw new Error('getPublicKey: expected string result from iframe.');
    }
    return result;
  }

  /** Send a `getRelays` request and await the relay map. */
  async getRelays(): Promise<RelayMap> {
    const result = await this.#request({ method: 'getRelays' });
    if (!result || typeof result !== 'object') {
      throw new Error('getRelays: expected object result from iframe.');
    }
    return result as RelayMap;
  }

  /** Send a `signEvent` request and await the signed event. */
  async signEvent(event: NostrEvent): Promise<NostrEvent> {
    const result = await this.#request({ method: 'signEvent', params: { event } });
    if (!result || typeof result !== 'object') {
      throw new Error('signEvent: expected NostrEvent result from iframe.');
    }
    return result as NostrEvent;
  }

  /**
   * NIP-44 v2 encrypt / decrypt. Mirrors the `window.nostr.nip44` shape so
   * existing Nostr clients can use the iframe as a drop-in NIP-07 provider.
   */
  readonly nip44 = {
    encrypt: async (peerPubkey: string, plaintext: string): Promise<string> => {
      const result = await this.#request({
        method: 'nip44_encrypt',
        params: { pubkey: peerPubkey, plaintext },
      });
      if (typeof result !== 'string') {
        throw new Error('nip44.encrypt: expected string result from iframe.');
      }
      return result;
    },
    decrypt: async (peerPubkey: string, ciphertext: string): Promise<string> => {
      const result = await this.#request({
        method: 'nip44_decrypt',
        params: { pubkey: peerPubkey, ciphertext },
      });
      if (typeof result !== 'string') {
        throw new Error('nip44.decrypt: expected string result from iframe.');
      }
      return result;
    },
  };

  /** NIP-04 (legacy) encrypt / decrypt. Same shape as `window.nostr.nip04`. */
  readonly nip04 = {
    encrypt: async (peerPubkey: string, plaintext: string): Promise<string> => {
      const result = await this.#request({
        method: 'nip04_encrypt',
        params: { pubkey: peerPubkey, plaintext },
      });
      if (typeof result !== 'string') {
        throw new Error('nip04.encrypt: expected string result from iframe.');
      }
      return result;
    },
    decrypt: async (peerPubkey: string, ciphertext: string): Promise<string> => {
      const result = await this.#request({
        method: 'nip04_decrypt',
        params: { pubkey: peerPubkey, ciphertext },
      });
      if (typeof result !== 'string') {
        throw new Error('nip04.decrypt: expected string result from iframe.');
      }
      return result;
    },
  };

  /** Remove the iframe, detach the listener, reject any pending requests. */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#options.window.removeEventListener('message', this.#listener);
    for (const [, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('NosskeyIframeClient destroyed.'));
    }
    this.#pending.clear();
    if (!this.#isReady && this.#readyReject) {
      this.#readyReject(new Error('NosskeyIframeClient destroyed before ready.'));
    }
    if (this.#iframe.parentNode) {
      this.#iframe.parentNode.removeChild(this.#iframe);
    }
  }

  #request(partial: {
    method: NosskeyRequest['method'];
    params?: NosskeyRequest['params'];
  }): Promise<unknown> {
    if (this.#destroyed) {
      return Promise.reject(new Error('NosskeyIframeClient has been destroyed.'));
    }
    const id = makeId(this.#options.window);
    const request: NosskeyRequest = {
      type: 'nosskey:request',
      id,
      method: partial.method,
      ...(partial.params ? { params: partial.params } : {}),
    };
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`Nosskey iframe request timed out after ${this.#options.timeout}ms.`));
      }, this.#options.timeout);
      this.#pending.set(id, { resolve, reject, timer });

      const target = this.#iframe.contentWindow;
      if (!target) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(new Error('Nosskey iframe is not ready to receive messages.'));
        return;
      }
      target.postMessage(request, this.#options.iframeOrigin);
    });
  }

  #handleMessage(event: MessageEvent): void {
    if (event.source !== this.#iframe.contentWindow) {
      return;
    }
    if (event.origin && event.origin !== this.#options.iframeOrigin) {
      return;
    }
    if (isNosskeyReady(event.data)) {
      if (!this.#isReady) {
        this.#isReady = true;
        this.#readyResolve?.();
      }
      return;
    }
    if (isNosskeyVisibility(event.data)) {
      this.#applyVisibility(event.data.visible);
      return;
    }
    if (isNosskeyResponse(event.data)) {
      this.#resolveResponse(event.data);
    }
  }

  #applyVisibility(visible: boolean): void {
    this.#iframe.style.display = visible ? 'block' : 'none';
    if (visible) {
      this.#iframe.removeAttribute('aria-hidden');
    } else {
      this.#iframe.setAttribute('aria-hidden', 'true');
    }
  }

  #resolveResponse(response: NosskeyResponse): void {
    const pending = this.#pending.get(response.id);
    if (!pending) return;
    this.#pending.delete(response.id);
    clearTimeout(pending.timer);
    if (response.error) {
      const err = new NosskeyIframeError(response.error.code, response.error.message);
      pending.reject(err);
    } else {
      pending.resolve(response.result);
    }
  }
}

/** Error surfaced to callers when the iframe returns an `error` response. */
export class NosskeyIframeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'NosskeyIframeError';
    this.code = code;
  }
}
