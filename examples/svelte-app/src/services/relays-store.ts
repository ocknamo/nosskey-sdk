import type { RelayMap } from 'nosskey-iframe';

/** localStorage key used to persist relay configuration. */
export const RELAYS_STORAGE_KEY = 'nosskey_relays';

function resolveStorage(override?: Storage | null): Storage | null {
  if (override) return override;
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

/**
 * Load the persisted relay map. Returns `{}` when missing or malformed.
 *
 * Pass `storage` to read from a specific Storage handle — needed when running
 * inside a partitioned iframe where the SDK was given a Storage Access API
 * handle pointing at first-party storage (Chromium keeps `window.localStorage`
 * partitioned even after the grant).
 */
export function loadRelays(storage?: Storage | null): RelayMap {
  const target = resolveStorage(storage);
  if (!target) return {};
  const raw = target.getItem(RELAYS_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as RelayMap;
  } catch {
    return {};
  }
}

/** Persist the relay map. See {@link loadRelays} for the `storage` parameter. */
export function saveRelays(relays: RelayMap, storage?: Storage | null): void {
  const target = resolveStorage(storage);
  if (!target) return;
  target.setItem(RELAYS_STORAGE_KEY, JSON.stringify(relays));
}
