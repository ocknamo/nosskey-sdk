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
  event?: NostrEvent;
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
    const { manager, requireUserConsent, onConsent } = this.#options;

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
        if (!manager.hasKeyInfo()) {
          throw new HostError('NO_KEY', 'No key is configured in the iframe.');
        }
        // The parent hides the iframe by default; show it so the consent
        // dialog is interactable and so the cross-origin WebAuthn prompt
        // fired inside manager.signEvent() has a visible frame to attach to.
        this.#postVisibility(true);
        try {
          if (requireUserConsent) {
            if (!onConsent) {
              throw new HostError(
                'INTERNAL',
                'onConsent must be provided when requireUserConsent is true.'
              );
            }
            const approved = await onConsent({ origin, method: 'signEvent', event });
            if (!approved) {
              throw new HostError('USER_REJECTED', 'User rejected the signing request.');
            }
          }
          return await manager.signEvent(event);
        } finally {
          this.#postVisibility(false);
        }
      }
      default: {
        // Exhaustiveness — request.method is typed as NosskeyMethod already,
        // but the guard below protects against malformed values slipping
        // past isNosskeyRequest in future refactors.
        throw new HostError('UNKNOWN_METHOD', `Unknown method: ${String(request.method)}`);
      }
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
