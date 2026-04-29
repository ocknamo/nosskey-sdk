import type { RelayMap } from 'nosskey-iframe';

/** localStorage key used to persist relay configuration. */
export const RELAYS_STORAGE_KEY = 'nosskey_relays';

function getStorage(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

/** Load the persisted relay map. Returns `{}` when missing or malformed. */
export function loadRelays(): RelayMap {
  const storage = getStorage();
  if (!storage) return {};
  const raw = storage.getItem(RELAYS_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as RelayMap;
  } catch {
    return {};
  }
}

/** Persist the relay map. */
export function saveRelays(relays: RelayMap): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(relays));
}
