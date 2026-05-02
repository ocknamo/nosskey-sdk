/**
 * NosskeyIframeHost — runs inside the Nosskey iframe and bridges postMessage
 * requests from the parent page to a {@link NosskeyManagerLike} instance.
 *
 * @packageDocumentation
 */
import type { NosskeyManagerLike, NostrEvent } from 'nosskey-sdk';
import {
  type NosskeyErrorCode,
  type NosskeyMethod,
  type NosskeyReady,
  type NosskeyRequest,
  type NosskeyResponse,
  type NosskeyVisibility,
  type RelayMap,
  isNosskeyRequest,
} from './protocol.js';

/** Caller-side data passed to an {@link NosskeyIframeHostOptions.onConsent} handler. */
export interface ConsentRequest {
  origin: string;
  method: NosskeyMethod;
  /** Set for `signEvent`. */
  event?: NostrEvent;
  /** Counterparty public key for nip44 / nip04 methods (32-byte hex). */
  pubkey?: string;
  /**
   * Plaintext shown for `nip44_encrypt` / `nip04_encrypt`. Intentionally not
   * present on decrypt (the iframe cannot decrypt before consent is granted).
   */
  plaintext?: string;
}

export interface NosskeyIframeHostOptions {
  /** Manager that fulfils the NIP-07 requests (normally a NosskeyManager instance). */
  manager: NosskeyManagerLike;
  /**
   * Origins allowed to communicate with this host. `'*'` disables the check
   * (useful during development — a console warning is emitted on start).
   *
   * @default '*'
   */
  allowedOrigins?: string[] | '*';
  /**
   * When true, signEvent requests require {@link onConsent} to resolve truthy.
   * @default true
   */
  requireUserConsent?: boolean;
  /** Called to obtain user consent. Required when `requireUserConsent` is true. */
  onConsent?: (request: ConsentRequest) => Promise<boolean>;
  /**
   * Resolves the relay map returned by NIP-07 `getRelays()`. Read-only and
   * never prompts the user. Omit to return an empty map.
   */
  onGetRelays?: () => Promise<RelayMap>;
  /** Override the window used to install the message listener. Defaults to globalThis.window. */
  window?: Window;
}

interface ResolvedOptions {
  manager: NosskeyManagerLike;
  allowedOrigins: string[] | '*';
  requireUserConsent: boolean;
  onConsent?: (request: ConsentRequest) => Promise<boolean>;
  onGetRelays?: () => Promise<RelayMap>;
  window: Window;
}

function resolveOptions(options: NosskeyIframeHostOptions): ResolvedOptions {
  const win = options.window ?? (globalThis as unknown as { window: Window }).window;
  if (!win) {
    throw new Error('NosskeyIframeHost requires a Window (provide options.window).');
  }
  return {
    manager: options.manager,
    allowedOrigins: options.allowedOrigins ?? '*',
    requireUserConsent: options.requireUserConsent ?? true,
    onConsent: options.onConsent,
    onGetRelays: options.onGetRelays,
    window: win,
  };
}

function isOriginAllowed(allowed: string[] | '*', origin: string): boolean {
  if (allowed === '*') return true;
  return allowed.includes(origin);
}

function buildError(code: NosskeyErrorCode, message: string) {
  return { code, message };
}

/**
 * Installs a `message` listener inside the iframe and routes requests to the
 * configured {@link NosskeyManagerLike}. Emits `nosskey:ready` on start.
 */
export class NosskeyIframeHost {
  readonly #options: ResolvedOptions;
  #started = false;
  #listener: ((event: MessageEvent) => Promise<void>) | null = null;

  constructor(options: NosskeyIframeHostOptions) {
    this.#options = resolveOptions(options);
  }

  /** Install the message listener and emit `nosskey:ready` to `window.parent`. */
  start(): void {
    if (this.#started) return;
    this.#started = true;

    if (this.#options.allowedOrigins === '*') {
      console.warn(
        '[nosskey-iframe] allowedOrigins is "*"; restrict this in production to avoid accepting requests from arbitrary origins.'
      );
    }

    // The listener is async so tests can await the full dispatch chain.
    // The browser ignores the returned promise — this is a harmless
    // relaxation of the EventListener signature.
    this.#listener = (event: MessageEvent) => this.#handleMessage(event);
    this.#options.window.addEventListener('message', this.#listener as unknown as EventListener);

    const ready: NosskeyReady = { type: 'nosskey:ready' };
    const parent = this.#options.window.parent;
    if (parent && parent !== this.#options.window) {
      parent.postMessage(ready, '*');
    }
  }

  /** Remove the message listener. Safe to call multiple times. */
  stop(): void {
    if (!this.#started) return;
    this.#started = false;
    if (this.#listener) {
      this.#options.window.removeEventListener(
        'message',
        this.#listener as unknown as EventListener
      );
      this.#listener = null;
    }
  }

  async #handleMessage(event: MessageEvent): Promise<void> {
    if (!isOriginAllowed(this.#options.allowedOrigins, event.origin)) {
      return; // Silently drop messages from unexpected origins.
    }
    if (!isNosskeyRequest(event.data)) {
      return;
    }
    const request = event.data;
    const reply = (response: NosskeyResponse) => {
      const source = event.source as Window | null;
      if (!source) return;
      source.postMessage(response, { targetOrigin: event.origin });
    };

    try {
      const result = await this.#dispatch(request, event.origin);
      reply({ type: 'nosskey:response', id: request.id, result });
    } catch (err) {
      if (err instanceof HostError) {
        reply({
          type: 'nosskey:response',
          id: request.id,
          error: buildError(err.code, err.message),
        });
      } else {
        reply({
          type: 'nosskey:response',
          id: request.id,
          error: buildError('INTERNAL', err instanceof Error ? err.message : String(err)),
        });
      }
    }
  }

  async #dispatch(request: NosskeyRequest, origin: string): Promise<unknown> {
    const { manager } = this.#options;

    switch (request.method) {
      case 'getPublicKey': {
        if (!manager.hasKeyInfo()) {
          throw new HostError('NO_KEY', 'No key is configured in the iframe.');
        }
        return manager.getPublicKey();
      }
      case 'getRelays': {
        const { onGetRelays } = this.#options;
        if (!onGetRelays) return {} satisfies RelayMap;
        return onGetRelays();
      }
      case 'signEvent': {
        const event = request.params?.event;
        if (!event || typeof event !== 'object') {
          throw new HostError('INVALID_REQUEST', 'signEvent requires params.event.');
        }
        return this.#withVisibilityAndConsent({ origin, method: 'signEvent', event }, () =>
          manager.signEvent(event)
        );
      }
      case 'nip44_encrypt': {
        const { pubkey, plaintext } = this.#requireEncryptParams(request, 'nip44_encrypt');
        return this.#withVisibilityAndConsent(
          { origin, method: 'nip44_encrypt', pubkey, plaintext },
          () => manager.nip44Encrypt(pubkey, plaintext)
        );
      }
      case 'nip44_decrypt': {
        const { pubkey, ciphertext } = this.#requireDecryptParams(request, 'nip44_decrypt');
        return this.#withVisibilityAndConsent({ origin, method: 'nip44_decrypt', pubkey }, () =>
          manager.nip44Decrypt(pubkey, ciphertext)
        );
      }
      case 'nip04_encrypt': {
        const { pubkey, plaintext } = this.#requireEncryptParams(request, 'nip04_encrypt');
        return this.#withVisibilityAndConsent(
          { origin, method: 'nip04_encrypt', pubkey, plaintext },
          () => manager.nip04Encrypt(pubkey, plaintext)
        );
      }
      case 'nip04_decrypt': {
        const { pubkey, ciphertext } = this.#requireDecryptParams(request, 'nip04_decrypt');
        return this.#withVisibilityAndConsent({ origin, method: 'nip04_decrypt', pubkey }, () =>
          manager.nip04Decrypt(pubkey, ciphertext)
        );
      }
      default: {
        // Exhaustiveness — request.method is typed as NosskeyMethod already,
        // but the guard below protects against malformed values slipping
        // past isNosskeyRequest in future refactors.
        throw new HostError('UNKNOWN_METHOD', `Unknown method: ${String(request.method)}`);
      }
    }
  }

  #requireEncryptParams(
    request: NosskeyRequest,
    method: NosskeyMethod
  ): { pubkey: string; plaintext: string } {
    const pubkey = request.params?.pubkey;
    const plaintext = request.params?.plaintext;
    if (typeof pubkey !== 'string' || typeof plaintext !== 'string') {
      throw new HostError(
        'INVALID_REQUEST',
        `${method} requires params.pubkey and params.plaintext (strings).`
      );
    }
    return { pubkey, plaintext };
  }

  #requireDecryptParams(
    request: NosskeyRequest,
    method: NosskeyMethod
  ): { pubkey: string; ciphertext: string } {
    const pubkey = request.params?.pubkey;
    const ciphertext = request.params?.ciphertext;
    if (typeof pubkey !== 'string' || typeof ciphertext !== 'string') {
      throw new HostError(
        'INVALID_REQUEST',
        `${method} requires params.pubkey and params.ciphertext (strings).`
      );
    }
    return { pubkey, ciphertext };
  }

  /**
   * Show the iframe, request user consent, run the operation, and hide the iframe.
   * Shared by signEvent and the nip44/nip04 encrypt/decrypt methods.
   */
  async #withVisibilityAndConsent<T>(consent: ConsentRequest, run: () => Promise<T>): Promise<T> {
    const { manager, requireUserConsent, onConsent } = this.#options;
    if (!manager.hasKeyInfo()) {
      throw new HostError('NO_KEY', 'No key is configured in the iframe.');
    }
    // Show the iframe so the consent dialog is interactable and so any
    // cross-origin WebAuthn prompt fired inside the manager call has a
    // visible frame to attach to.
    this.#postVisibility(true);
    try {
      if (requireUserConsent) {
        if (!onConsent) {
          throw new HostError(
            'INTERNAL',
            'onConsent must be provided when requireUserConsent is true.'
          );
        }
        const approved = await onConsent(consent);
        if (!approved) {
          throw new HostError('USER_REJECTED', `User rejected the ${consent.method} request.`);
        }
      }
      return await run();
    } finally {
      this.#postVisibility(false);
    }
  }

  #postVisibility(visible: boolean): void {
    const parent = this.#options.window.parent;
    if (!parent || parent === this.#options.window) return;
    const message: NosskeyVisibility = { type: 'nosskey:visibility', visible };
    parent.postMessage(message, '*');
  }
}

class HostError extends Error {
  constructor(
    readonly code: NosskeyErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'HostError';
  }
}
