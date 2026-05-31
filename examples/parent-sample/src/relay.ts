/**
 * WebSocket relay publish helper. Opens a connection, sends ["EVENT", signed],
 * and resolves on the first OK/NOTICE frame (or close, or timeout).
 *
 * Test seam: `webSocketImpl` lets specs inject a fake constructor so the state
 * machine can be exercised without a real network. `log` is injected so the
 * helper has no DOM coupling.
 */
import type { NostrEvent } from 'nosskey-sdk';
import { formatError } from './nips.js';
import type { Logger } from './ui.js';

export const DEFAULT_PUBLISH_ACK_TIMEOUT_MS = 8000;

/** NIP-07 `getRelays()` return shape: relay URL → read/write flags. */
export type RelayMap = Record<string, { read: boolean; write: boolean }>;

export interface PublishOptions {
  log: Logger;
  timeoutMs?: number;
  webSocketImpl?: typeof WebSocket;
}

export function publishEvent(
  relayUrl: string,
  event: NostrEvent,
  opts: PublishOptions
): Promise<void> {
  const { log, timeoutMs = DEFAULT_PUBLISH_ACK_TIMEOUT_MS, webSocketImpl = WebSocket } = opts;
  return new Promise((resolve, reject) => {
    let settled = false;
    let ws: WebSocket;
    try {
      ws = new webSocketImpl(relayUrl);
    } catch (err) {
      reject(err);
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      log(`Relay ${relayUrl}: no OK/NOTICE within ${timeoutMs}ms, closing.`);
      ws.close();
      resolve();
    }, timeoutMs);

    ws.addEventListener('open', () => {
      log(`Relay ${relayUrl}: connection open, sending EVENT.`);
      ws.send(JSON.stringify(['EVENT', event]));
    });

    ws.addEventListener('message', (msg) => {
      const data = typeof msg.data === 'string' ? msg.data : '<binary>';
      log(`Relay ${relayUrl}: ${data}`);
      if (data === '<binary>') return;
      try {
        const parsed: unknown = JSON.parse(data);
        if (Array.isArray(parsed) && (parsed[0] === 'OK' || parsed[0] === 'NOTICE') && !settled) {
          settled = true;
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      } catch {
        // Non-JSON payload — ignore and wait for timer.
      }
    });

    ws.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`WebSocket error for ${relayUrl}`));
    });

    ws.addEventListener('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });
  });
}

export interface ResolvePublishRelaysOptions {
  /** The iframe-backed `window.nostr.getRelays()`. */
  getRelays: () => Promise<RelayMap>;
  /** Manually entered relay URL used as a fallback (null when the field is empty). */
  fallbackRelayUrl: string | null;
  log: Logger;
}

/**
 * Picks the relays to publish to. Prefers the write-enabled relays advertised
 * by the iframe via `getRelays()`; falls back to the manually entered relay URL
 * when `getRelays()` fails or advertises no write relay. Returns an empty array
 * only when neither source yields a relay — the caller treats that as an error.
 */
export async function resolvePublishRelays(opts: ResolvePublishRelaysOptions): Promise<string[]> {
  const { getRelays, fallbackRelayUrl, log } = opts;
  const fallback = fallbackRelayUrl ? [fallbackRelayUrl] : [];
  try {
    const relays = await getRelays();
    const writeRelays = Object.entries(relays)
      .filter(([, flags]) => flags?.write)
      .map(([url]) => url);
    if (writeRelays.length > 0) {
      log(
        `Publish targets from getRelays(): ${writeRelays.length} write relay(s) — ${writeRelays.join(', ')}.`
      );
      return writeRelays;
    }
    if (fallback.length > 0) {
      log('getRelays() advertised no write relay; falling back to the manual relay URL.');
      return fallback;
    }
    log('getRelays() advertised no write relay and no manual relay URL was provided.');
    return [];
  } catch (err) {
    if (fallback.length > 0) {
      log(`getRelays() failed (${formatError(err)}); falling back to the manual relay URL.`);
      return fallback;
    }
    log(`getRelays() failed (${formatError(err)}) and no manual relay URL was provided.`);
    return [];
  }
}

export interface PublishToRelaysResult {
  succeeded: string[];
  failed: { url: string; error: string }[];
}

/**
 * Publishes a signed event to several relays in parallel. Resolves with a
 * per-relay summary and never rejects — callers inspect `succeeded` / `failed`
 * to decide whether the publish as a whole was a success.
 */
export async function publishToRelays(
  relayUrls: string[],
  event: NostrEvent,
  opts: PublishOptions
): Promise<PublishToRelaysResult> {
  const outcomes = await Promise.allSettled(relayUrls.map((url) => publishEvent(url, event, opts)));
  const succeeded: string[] = [];
  const failed: { url: string; error: string }[] = [];
  outcomes.forEach((outcome, i) => {
    const url = relayUrls[i];
    if (outcome.status === 'fulfilled') {
      succeeded.push(url);
    } else {
      failed.push({ url, error: formatError(outcome.reason) });
    }
  });
  return { succeeded, failed };
}
