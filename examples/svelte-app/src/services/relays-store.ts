import type { RelayMap } from 'nosskey-iframe';

/** localStorage key used to persist relay configuration. */
export const RELAYS_STORAGE_KEY = 'nosskey_relays';

/**
 * 初回起動時（リレー設定が一度も保存されていないとき）に使う既定リレーの URL。
 * プロフィール画像（kind:0）の取得がリレー設定ゼロでも動くようにするためのもの。
 * ユーザーが設定画面でリレーを編集・全削除すると、その内容（空マップを含む）が
 * 保存され、以降はそちらが優先される。
 */
export const DEFAULT_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://yabu.me',
] as const;

/** 既定リレーの {@link RelayMap}。呼び出しごとに新しいオブジェクトを生成する。 */
function defaultRelayMap(): RelayMap {
  const map: RelayMap = {};
  for (const url of DEFAULT_RELAY_URLS) {
    map[url] = { read: true, write: true };
  }
  return map;
}

function resolveStorage(override?: Storage | null): Storage | null {
  if (override) return override;
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

/**
 * Load the persisted relay map. When no relay config has been saved yet — or
 * the stored value is malformed — the {@link DEFAULT_RELAY_URLS} set is
 * returned (read+write) so profile fetching works out of the box. An
 * explicitly saved empty map (`{}`) is respected and returned as-is.
 *
 * Pass `storage` to read from a specific Storage handle — needed when running
 * inside a partitioned iframe where the SDK was given a Storage Access API
 * handle pointing at first-party storage (Chromium keeps `window.localStorage`
 * partitioned even after the grant).
 */
export function loadRelays(storage?: Storage | null): RelayMap {
  const target = resolveStorage(storage);
  if (!target) return defaultRelayMap();
  const raw = target.getItem(RELAYS_STORAGE_KEY);
  if (!raw) return defaultRelayMap();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('[nosskey] stored relay config appears corrupted. Falling back to defaults.');
      return defaultRelayMap();
    }
    return parsed as RelayMap;
  } catch {
    console.warn('[nosskey] stored relay config is not valid JSON. Falling back to defaults.');
    return defaultRelayMap();
  }
}

/** Persist the relay map. See {@link loadRelays} for the `storage` parameter. */
export function saveRelays(relays: RelayMap, storage?: Storage | null): void {
  const target = resolveStorage(storage);
  if (!target) return;
  target.setItem(RELAYS_STORAGE_KEY, JSON.stringify(relays));
}
