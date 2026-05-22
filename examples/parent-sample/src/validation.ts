/**
 * Input parsers for the parent-sample UI. Each parser trims whitespace and
 * returns either the cleaned value or a short reason string that the caller
 * appends to a context-specific log message ("NIP-04 DM aborted: ...").
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function npubToHex(npub: string): string | null {
  try {
    const lower = npub.toLowerCase();
    const sep = lower.lastIndexOf('1');
    if (sep < 0 || lower.slice(0, sep) !== 'npub') return null;
    // data portion: everything after the separator, minus the 6-char checksum
    const dataStr = lower.slice(sep + 1, lower.length - 6);
    if (dataStr.length === 0) return null;
    const data5: number[] = [];
    for (const ch of dataStr) {
      const idx = BECH32_CHARSET.indexOf(ch);
      if (idx === -1) return null;
      data5.push(idx);
    }
    // convert 5-bit groups to 8-bit bytes
    let acc = 0;
    let bits = 0;
    const bytes: number[] = [];
    for (const val of data5) {
      acc = (acc << 5) | val;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((acc >> bits) & 0xff);
      }
    }
    if (bytes.length !== 32) return null;
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export function parsePeerPubkey(raw: string): ParseResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'peer pubkey is empty' };
  if (trimmed.toLowerCase().startsWith('npub1')) {
    const hex = npubToHex(trimmed);
    if (!hex) return { ok: false, reason: 'invalid npub format' };
    return { ok: true, value: hex };
  }
  return { ok: true, value: trimmed };
}

export function parseRelayUrl(raw: string): ParseResult<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'relay URL is empty' };
  return { ok: true, value: trimmed };
}
