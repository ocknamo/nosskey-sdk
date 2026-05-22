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

  it('accepts a valid npub and converts it to hex', () => {
    // NIP-19 test vector from the spec
    const npub = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6';
    const hex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
    expect(parsePeerPubkey(npub)).toEqual({ ok: true, value: hex });
  });

  it('rejects an npub-prefixed string that is not a valid npub', () => {
    expect(parsePeerPubkey('npub1example')).toEqual({ ok: false, reason: 'invalid npub format' });
  });

  it('accepts a non-npub non-empty value as-is (no format validation)', () => {
    // Non-npub inputs pass through unchanged; format errors surface from the iframe.
    expect(parsePeerPubkey('notanpub')).toEqual({ ok: true, value: 'notanpub' });
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
