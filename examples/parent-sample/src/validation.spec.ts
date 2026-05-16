import { describe, expect, it } from 'vitest';
import { parsePeerPubkey, parseRelayUrl } from './validation.js';

describe('parsePeerPubkey', () => {
  it('rejects an empty string', () => {
    expect(parsePeerPubkey('')).toEqual({ ok: false, reason: 'peer pubkey is empty' });
  });

  it('rejects whitespace-only input', () => {
    expect(parsePeerPubkey('   \t\n')).toEqual({ ok: false, reason: 'peer pubkey is empty' });
  });

  it('accepts a non-empty value and returns the trimmed value', () => {
    const hex = 'a'.repeat(64);
    expect(parsePeerPubkey(`  ${hex}  `)).toEqual({ ok: true, value: hex });
  });

  it('does not validate the pubkey format (matches current behavior)', () => {
    // Intentional: the existing sample does not pre-validate the pubkey shape —
    // a malformed key surfaces as an error from the iframe instead. This test
    // pins that behavior.
    expect(parsePeerPubkey('npub1example')).toEqual({ ok: true, value: 'npub1example' });
  });
});

describe('parseRelayUrl', () => {
  it('rejects an empty string', () => {
    expect(parseRelayUrl('')).toEqual({ ok: false, reason: 'relay URL is empty' });
  });

  it('rejects whitespace-only input', () => {
    expect(parseRelayUrl('   ')).toEqual({ ok: false, reason: 'relay URL is empty' });
  });

  it('accepts any non-empty trimmed value (matches current behavior)', () => {
    expect(parseRelayUrl('  wss://relay.damus.io  ')).toEqual({
      ok: true,
      value: 'wss://relay.damus.io',
    });
  });

  it('does not validate the URL scheme', () => {
    // Intentional: the existing sample does not pre-validate scheme — the WebSocket
    // constructor surfaces the error instead. This test pins that behavior.
    expect(parseRelayUrl('not-a-url')).toEqual({ ok: true, value: 'not-a-url' });
  });
});
