/**
 * WebSocket relay publish helper. Opens a connection, sends ["EVENT", signed],
 * and resolves on the first OK/NOTICE frame (or close, or timeout).
 *
 * Test seam: `webSocketImpl` lets specs inject a fake constructor so the state
 * machine can be exercised without a real network. `log` is injected so the
 * helper has no DOM coupling.
 */
import type { NostrEvent } from 'nosskey-sdk';
import type { Logger } from './ui.js';

export const DEFAULT_PUBLISH_ACK_TIMEOUT_MS = 8000;

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
