/**
 * NosskeyIframeHost — runs inside the Nosskey iframe and bridges postMessage
 * requests from the parent page to a {@link NosskeyManagerLike} instance.
 *
 * @packageDocumentation
 */
import {
  isConnectMethod,
  isNosskeyRequest,
  type NosskeyErrorCode,
  type NosskeyMethod,
  type NosskeyReady,
  type NosskeyRequest,
  type NosskeyResponse,
  type NosskeyVisibility,
  type RelayMap,
} from './protocol.js';
import type { NosskeyManagerLike, NostrEvent } from './types.js';

/** Caller-side data passed to an {@link NosskeyIframeHostOptions.onConsent} handler. */
export interface ConsentRequest {
  origin: string;
  method: NosskeyMethod;
  /** Set for `signEvent`. Always undefined for `getPublicKey` / `getRelays`. */
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
   * Origins allowed to communicate with this host. This is **required** — there
   * is no default. Pass an explicit allowlist (recommended whenever the parent
   * origin is known, e.g. self-hosted integrations) or the literal `'*'` to
   * opt in to open embedding (any origin may send requests; a console warning
   * is emitted on start). Omitting it throws so that "accept every origin" is
   * always a deliberate choice rather than a silent default (secure-by-default).
   */
  allowedOrigins: string[] | '*';
  /**
   * When true, all consent-required methods (`getPublicKey`, `getRelays`,
   * `signEvent`, nip44/nip04 encrypt/decrypt) require {@link onConsent} to
   * resolve truthy. For `getPublicKey` / `getRelays` this acts as a
   * per-origin connection approval that blocks silent user identification
   * by arbitrary embedding origins.
   * @default true
   */
  requireUserConsent?: boolean;
  /** Called to obtain user consent. Required when `requireUserConsent` is true. */
  onConsent?: (request: ConsentRequest) => Promise<boolean>;
  /**
   * Resolves the relay map returned by NIP-07 `getRelays()`. Subject to the
   * same consent gate as `getPublicKey` when a key is configured (the relay
   * set identifies the logged-in user). Omit to return an empty map without
   * prompting.
   */
  onGetRelays?: () => Promise<RelayMap>;
  /**
   * Per-origin guard against consent-fatigue / probing attacks: a parent that
   * keeps firing consent-required requests can otherwise spam the dialog
   * indefinitely. After {@link RateLimitOptions.maxConsecutiveRejections}
   * consecutive rejections from the same origin, further consent-required
   * requests are short-circuited with a `RATE_LIMITED` error (no dialog
   * shown, the iframe stays hidden) until {@link RateLimitOptions.blockMs}
   * elapses. A single approval resets the counter. Applies only when
   * `requireUserConsent` is true. Pass `false` to disable entirely.
   * @default enabled with maxConsecutiveRejections=5, blockMs=60000
   */
  rateLimit?: RateLimitOptions | false;
  /**
   * Called when a consent-required request arrives while the manager has no key,
   * instead of failing the request with `NO_KEY` right away. The iframe is made
   * visible first, so the host page can show a recovery UI (e.g. the Storage
   * Access API prompt) and resolve `true` once the key is readable.
   *
   * This exists because WebKit partitions a third-party iframe's `localStorage`
   * and only unpartitions cookies, and only after a **user gesture**. Without
   * this hook the host answers `NO_KEY` before the user has had any chance to
   * grant access; the parent has already given up by the time recovery succeeds,
   * so the user sees "access granted" and a failed login at the same time.
   *
   * Resolve `false` when the key genuinely does not exist or the user dismissed
   * the recovery UI — the request then fails with `NO_KEY` as before. Do not
   * wait on anything slow (e.g. registering a new passkey in another tab): the
   * parent's request timeout, 60s by default, is still running.
   *
   * Omit to keep the previous behaviour (immediate `NO_KEY`, iframe stays hidden).
   */
  onKeyUnavailable?: () => Promise<boolean>;
  /**
   * Delays the `nosskey:ready` handshake until this settles (resolved or
   * rejected). Use it to finish resolving which storage the manager reads from
   * before the parent is told it may start sending requests — otherwise the
   * first request races storage recovery and fails with `NO_KEY`.
   *
   * Capped at {@link STORAGE_READY_TIMEOUT_MS} so a gate that never settles
   * cannot brick the handshake.
   */
  storageReady?: Promise<unknown>;
  /** Override the window used to install the message listener. Defaults to globalThis.window. */
  window?: Window;
}

/**
 * How long {@link NosskeyIframeHostOptions.storageReady} may delay the ready
 * handshake. Past this the host announces readiness anyway: a late handshake
 * degrades to the old racy behaviour, while no handshake at all breaks the
 * parent entirely.
 */
export const STORAGE_READY_TIMEOUT_MS = 5_000;

/**
 * How long {@link NosskeyIframeHostOptions.onKeyUnavailable} may hold a request
 * open. A handler that never settles would otherwise leave the request awaiting
 * forever — and with it the iframe visible, since the visibility is only
 * restored once the request finishes. Matches `NosskeyIframeClient`'s default
 * request timeout so the host cleans up no later than the parent gives up.
 */
export const KEY_RECOVERY_TIMEOUT_MS = 60_000;

/** Tuning for the per-origin consent rate limiter. See {@link NosskeyIframeHostOptions.rateLimit}. */
export interface RateLimitOptions {
  /**
   * Number of consecutive rejections from one origin that trips the temporary
   * block. Must be a positive integer.
   * @default 5
   */
  maxConsecutiveRejections?: number;
  /**
   * How long (ms) an origin stays blocked after tripping the threshold.
   * @default 60000
   */
  blockMs?: number;
}

const DEFAULT_MAX_CONSECUTIVE_REJECTIONS = 5;
const DEFAULT_BLOCK_MS = 60_000;

interface ResolvedRateLimit {
  maxConsecutiveRejections: number;
  blockMs: number;
}

/** Mutable per-origin rate-limit bookkeeping. */
interface OriginRateState {
  consecutiveRejections: number;
  /** Epoch ms until which the origin is blocked; 0 when not blocked. */
  blockedUntil: number;
}

interface ResolvedOptions {
  manager: NosskeyManagerLike;
  allowedOrigins: string[] | '*';
  requireUserConsent: boolean;
  onConsent?: (request: ConsentRequest) => Promise<boolean>;
  onGetRelays?: () => Promise<RelayMap>;
  onKeyUnavailable?: () => Promise<boolean>;
  storageReady?: Promise<unknown>;
  rateLimit: ResolvedRateLimit | null;
  window: Window;
}

function resolveRateLimit(
  rateLimit: RateLimitOptions | false | undefined
): ResolvedRateLimit | null {
  if (rateLimit === false) return null;
  const opts = rateLimit ?? {};
  const max = opts.maxConsecutiveRejections ?? DEFAULT_MAX_CONSECUTIVE_REJECTIONS;
  const blockMs = opts.blockMs ?? DEFAULT_BLOCK_MS;
  if (!Number.isInteger(max) || max < 1) {
    throw new Error(
      'NosskeyIframeHost rateLimit.maxConsecutiveRejections must be a positive integer.'
    );
  }
  if (!Number.isFinite(blockMs) || blockMs < 0) {
    throw new Error('NosskeyIframeHost rateLimit.blockMs must be a non-negative finite number.');
  }
  return { maxConsecutiveRejections: max, blockMs };
}

function resolveOptions(options: NosskeyIframeHostOptions): ResolvedOptions {
  const win = options.window ?? (globalThis as unknown as { window: Window }).window;
  if (!win) {
    throw new Error('NosskeyIframeHost requires a Window (provide options.window).');
  }
  if (options.allowedOrigins !== '*' && !Array.isArray(options.allowedOrigins)) {
    throw new Error(
      'NosskeyIframeHost requires options.allowedOrigins: pass an explicit list of ' +
        "parent origins, or '*' to deliberately opt in to open embedding."
    );
  }
  return {
    manager: options.manager,
    allowedOrigins: options.allowedOrigins,
    requireUserConsent: options.requireUserConsent ?? true,
    onConsent: options.onConsent,
    onGetRelays: options.onGetRelays,
    onKeyUnavailable: options.onKeyUnavailable,
    storageReady: options.storageReady,
    rateLimit: resolveRateLimit(options.rateLimit),
    window: win,
  };
}

function isOriginAllowed(allowed: string[] | '*', origin: string): boolean {
  if (allowed === '*') return true;
  return allowed.includes(origin);
}

/**
 * Resolve `false` if `promise` has not settled within `ms`. Used as a backstop
 * for host-supplied handlers: without it a handler that never settles keeps the
 * request — and the iframe's visibility — open forever.
 */
async function withTimeout(promise: Promise<boolean>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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
  /**
   * Incremented on every {@link start}. A deferred ready announcement compares
   * it before posting, so a `stop()` / `start()` cycle cannot let the previous
   * run's pending announcement fire for the current one.
   */
  #runId = 0;
  #listener: ((event: MessageEvent) => Promise<void>) | null = null;
  /** Per-origin consent rate-limit state. Lazily populated. */
  readonly #rateState = new Map<string, OriginRateState>();
  /** Hidden element used to pull focus into this document. Created on first use. */
  #focusAnchor: HTMLElement | null = null;

  constructor(options: NosskeyIframeHostOptions) {
    this.#options = resolveOptions(options);
  }

  /** Install the message listener and emit `nosskey:ready` to `window.parent`. */
  start(): void {
    if (this.#started) return;
    this.#started = true;
    const runId = ++this.#runId;

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

    // The listener is installed synchronously, but readiness is announced only
    // once storage has settled: a parent told "ready" too early fires its first
    // request while the iframe still reads partitioned (empty) storage.
    void this.#announceReady(runId);
  }

  /**
   * Post `nosskey:ready` once {@link NosskeyIframeHostOptions.storageReady}
   * settles, or after {@link STORAGE_READY_TIMEOUT_MS}, whichever comes first.
   * A rejected gate still announces readiness — storage recovery failing is not
   * a reason to leave the parent hanging.
   */
  async #announceReady(runId: number): Promise<void> {
    const gate = this.#options.storageReady;
    if (gate) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          gate,
          new Promise((resolve) => {
            timer = setTimeout(resolve, STORAGE_READY_TIMEOUT_MS);
          }),
        ]);
      } catch (err) {
        // A failed storage resolution is not a reason to leave the parent
        // hanging — announce readiness and let the request path report it.
        console.warn('[nosskey-iframe] storageReady rejected; announcing ready anyway', err);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }
    // Between awaiting and here the host may have been stopped, or stopped and
    // started again — in which case the current run owns the announcement.
    if (!this.#started || runId !== this.#runId) return;
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
    this.#focusAnchor?.remove();
    this.#focusAnchor = null;
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
        return this.#withVisibilityAndConsent({ origin, method: 'getPublicKey' }, () =>
          manager.getPublicKey()
        );
      }
      case 'getRelays': {
        const { onGetRelays } = this.#options;
        // An empty map carries no user-identifying information, so the two
        // cases below stay consent-free: no relay resolver configured, or no
        // key (= nobody logged in to identify).
        if (!onGetRelays) return {} satisfies RelayMap;
        if (!manager.hasKeyInfo()) return {} satisfies RelayMap;
        return this.#withVisibilityAndConsent({ origin, method: 'getRelays' }, () => onGetRelays());
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
   * Shared by getPublicKey, getRelays, signEvent, and the nip44/nip04
   * encrypt/decrypt methods.
   */
  async #withVisibilityAndConsent<T>(consent: ConsentRequest, run: () => Promise<T>): Promise<T> {
    const { manager, requireUserConsent, onConsent, onKeyUnavailable } = this.#options;
    // Recovery is attempted only when the host offered a way to do it. Without
    // one the answer is the same immediate NO_KEY as before, and the iframe is
    // never revealed for a keyless host.
    const needsRecovery = !manager.hasKeyInfo();
    if (needsRecovery && !onKeyUnavailable) {
      throw new HostError('NO_KEY', 'No key is configured in the iframe.');
    }
    if (requireUserConsent && !onConsent) {
      throw new HostError(
        'INTERNAL',
        'onConsent must be provided when requireUserConsent is true.'
      );
    }
    // Block flooding origins *before* revealing the iframe: a blocked origin
    // gets no dialog, no recovery UI and no visibility flicker. Recovery is
    // gated too, and independently of `requireUserConsent`: it also opens the
    // iframe, so a host without a consent gate would otherwise be defenceless.
    if (requireUserConsent || needsRecovery) {
      this.#assertNotRateLimited(consent.origin);
    }
    // Show the iframe so the recovery UI and the consent dialog are
    // interactable, and so any cross-origin WebAuthn prompt fired inside the
    // manager call has a visible frame to attach to.
    this.#postVisibility(true);
    try {
      if (needsRecovery && onKeyUnavailable) {
        const recovered = await withTimeout(onKeyUnavailable(), KEY_RECOVERY_TIMEOUT_MS);
        // A dismissed recovery counts like a rejection so that an origin cannot
        // keep forcing the iframe open by re-requesting. A successful one does
        // not clear the counter: the user approved storage access, not this
        // origin's requests, so the consent-fatigue guard must keep its state.
        if (!recovered) this.#recordConsentOutcome(consent.origin, false);
        // Re-check rather than trust the handler: the key must actually be
        // readable now, not merely reported as recovered.
        if (!recovered || !manager.hasKeyInfo()) {
          throw new HostError('NO_KEY', 'No key is configured in the iframe.');
        }
      }
      if (requireUserConsent && onConsent) {
        const approved = await onConsent(consent);
        this.#recordConsentOutcome(consent.origin, approved);
        if (!approved) {
          throw new HostError('USER_REJECTED', `User rejected the ${consent.method} request.`);
        }
      }
      // Only for operations that derive the secret key — `getPublicKey` and
      // `getRelays` just read storage, and taking focus for those would pull it
      // off whatever the parent page had focused.
      if (!isConnectMethod(consent.method)) this.#focusForWebAuthn();
      return await run();
    } finally {
      this.#postVisibility(false);
    }
  }

  /**
   * Give this document focus before an operation that may invoke WebAuthn.
   *
   * WebKit refuses `navigator.credentials.get()` with "The document is not
   * focused." unless the calling document is the focused one. The user taps in
   * the *parent* page, which focuses the parent; when consent is auto-approved
   * (a trusted origin, or an `always` policy) nothing is ever tapped inside the
   * iframe, so every signature fails. Observed on iOS 18.7 / Safari 26.6.1,
   * where signing only succeeded right after the user had tapped the storage
   * access button inside the iframe.
   *
   * Best-effort and silent: focus is a hint, and a host that cannot take it
   * should still let the operation run and report the real error.
   */
  #focusForWebAuthn(): void {
    const win = this.#options.window;
    const doc = win.document as Document | undefined;
    if (!doc || doc.hasFocus?.()) return;
    try {
      win.focus();
    } catch {
      // A cross-origin frame may be refused; the element focus below is the fallback.
    }
    if (doc.hasFocus?.()) return;
    try {
      // Moving focus to a real element is what actually brings focus into this
      // document. The anchor is kept (not removed) because removing a focused
      // element hands focus straight back.
      if (!this.#focusAnchor || !this.#focusAnchor.isConnected) {
        const anchor = doc.createElement('div');
        anchor.tabIndex = -1;
        anchor.setAttribute('aria-hidden', 'true');
        anchor.style.cssText =
          'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
        doc.body?.appendChild(anchor);
        this.#focusAnchor = anchor;
      }
      this.#focusAnchor.focus({ preventScroll: true });
    } catch {
      // Best effort. The operation still runs and surfaces the real failure.
    }
  }

  /**
   * Throw `RATE_LIMITED` if `origin` is currently inside a block window.
   * Expired blocks are cleared so the origin gets a fresh start.
   */
  #assertNotRateLimited(origin: string): void {
    const limit = this.#options.rateLimit;
    if (!limit) return;
    const state = this.#rateState.get(origin);
    if (!state || state.blockedUntil === 0) return;
    if (Date.now() < state.blockedUntil) {
      throw new HostError(
        'RATE_LIMITED',
        'Too many consecutive rejected requests from this origin; try again later.'
      );
    }
    // Block expired: reset so the origin is treated as fresh.
    state.blockedUntil = 0;
    state.consecutiveRejections = 0;
  }

  /**
   * Update per-origin rejection bookkeeping after a consent decision. An
   * approval clears the counter; the Nth consecutive rejection arms the block.
   */
  #recordConsentOutcome(origin: string, approved: boolean): void {
    const limit = this.#options.rateLimit;
    if (!limit) return;
    if (approved) {
      this.#rateState.delete(origin);
      return;
    }
    const state = this.#rateState.get(origin) ?? { consecutiveRejections: 0, blockedUntil: 0 };
    state.consecutiveRejections += 1;
    if (state.consecutiveRejections >= limit.maxConsecutiveRejections) {
      state.blockedUntil = Date.now() + limit.blockMs;
      state.consecutiveRejections = 0;
    }
    this.#rateState.set(origin, state);
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
