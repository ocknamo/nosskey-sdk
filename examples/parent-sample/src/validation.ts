/**
 * Input parsers for the parent-sample UI. Each parser trims whitespace and
 * returns either the cleaned value or a short reason string that the caller
 * appends to a context-specific log message ("NIP-04 DM aborted: ...").
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function parsePeerPubkey(raw: string): ParseResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'peer pubkey is empty' };
  return { ok: true, value: trimmed };
}

export function parseRelayUrl(raw: string): ParseResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'relay URL is empty' };
  return { ok: true, value: trimmed };
}
