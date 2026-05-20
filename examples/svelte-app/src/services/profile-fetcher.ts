/**
 * Nostr リレーから kind:0 (NIP-01 metadata) を取得する最小実装。
 *
 * rx-nostr 等の依存を持ち込まず、ネイティブ WebSocket を直接叩く。サンプル
 * アプリでは過去にリレーアクセス機能を削除しており、プロフィール画像を
 * 表示するためだけに大きな依存を増やしたくないため。
 *
 * 複数リレーに並列接続し、得られた EVENT のうち最も新しい (`created_at` 最大)
 * ものの `content` を JSON として解析して返す。タイムアウトと AbortSignal で
 * 必ず全 socket をクローズする。
 */

export interface Kind0ProfileResult {
  picture?: string;
  name?: string;
  display_name?: string;
  created_at: number;
}

export interface FetchKind0Options {
  /** 全リレーを諦めるまでの最大ミリ秒（既定 5000）。 */
  timeoutMs?: number;
  /** テスト時に WebSocket をモックするための DI。 */
  wsFactory?: (url: string) => WebSocket;
}

interface NostrEventLike {
  id?: unknown;
  kind?: unknown;
  pubkey?: unknown;
  created_at?: unknown;
  content?: unknown;
}

const DEFAULT_TIMEOUT_MS = 5000;

function defaultWsFactory(url: string): WebSocket {
  return new WebSocket(url);
}

/**
 * 指定 pubkey の kind:0 を複数リレーに並列問い合わせし、最新のものを返す。
 * 全リレーで何も得られなければ null。
 */
export async function fetchKind0Profile(
  pubkey: string,
  relays: string[],
  opts: FetchKind0Options = {}
): Promise<Kind0ProfileResult | null> {
  if (!pubkey || relays.length === 0) return null;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const wsFactory = opts.wsFactory ?? defaultWsFactory;

  // 各リレーで `created_at` が異なるため、全リレー完了まで待って最新値を採用する。
  // 最初の応答で打ち切ると古いキャッシュを返してしまう可能性があるため、stale-
  // while-revalidate の「裏更新」用途としては全件待ちが妥当。最遅リレーが応答せず
  // とも `timeoutMs`（既定 5000ms）で必ず settle する。
  const results = await Promise.all(
    relays.map((url) => fetchFromOneRelay(url, pubkey, timeoutMs, wsFactory))
  );

  let best: Kind0ProfileResult | null = null;
  for (const r of results) {
    if (!r) continue;
    if (!best || r.created_at > best.created_at) best = r;
  }
  return best;
}

function fetchFromOneRelay(
  url: string,
  pubkey: string,
  timeoutMs: number,
  wsFactory: (url: string) => WebSocket
): Promise<Kind0ProfileResult | null> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    try {
      ws = wsFactory(url);
    } catch (err) {
      console.warn(`[nosskey] profile fetch: failed to open ${url}:`, err);
      resolve(null);
      return;
    }

    const subId = generateSubId();
    let best: Kind0ProfileResult | null = null;
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['CLOSE', subId]));
        }
      } catch {
        /* ignore */
      }
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(best);
    };

    const timer = setTimeout(cleanup, timeoutMs);

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify(['REQ', subId, { kinds: [0], authors: [pubkey], limit: 1 }]));
      } catch (err) {
        console.warn(`[nosskey] profile fetch: REQ send failed on ${url}:`, err);
        cleanup();
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      const data = typeof event.data === 'string' ? event.data : null;
      if (!data) return;
      let msg: unknown;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      if (!Array.isArray(msg)) return;
      const tag = msg[0];
      if (tag === 'EVENT' && msg[1] === subId) {
        const parsed = parseKind0Event(msg[2], pubkey);
        if (parsed && (!best || parsed.created_at > best.created_at)) {
          best = parsed;
        }
      } else if (tag === 'EOSE' && msg[1] === subId) {
        cleanup();
      } else if (tag === 'CLOSED' && msg[1] === subId) {
        cleanup();
      }
    };

    ws.onerror = () => {
      // socket レベルの失敗は warn のみ。全リレー失敗時に null を返す経路に任せる。
      console.warn(`[nosskey] profile fetch: socket error on ${url}`);
      cleanup();
    };

    ws.onclose = () => {
      cleanup();
    };
  });
}

function parseKind0Event(event: unknown, expectedPubkey: string): Kind0ProfileResult | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as NostrEventLike;
  if (e.kind !== 0) return null;
  if (typeof e.pubkey !== 'string' || e.pubkey !== expectedPubkey) return null;
  if (typeof e.created_at !== 'number') return null;
  if (typeof e.content !== 'string') return null;
  let metadata: unknown;
  try {
    metadata = JSON.parse(e.content);
  } catch {
    return null;
  }
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  return {
    picture: typeof m.picture === 'string' ? m.picture : undefined,
    name: typeof m.name === 'string' ? m.name : undefined,
    display_name: typeof m.display_name === 'string' ? m.display_name : undefined,
    created_at: e.created_at,
  };
}

function generateSubId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `nosskey-profile-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `nosskey-profile-${Math.random().toString(36).slice(2, 10)}`;
}
