import { NosskeyIframeError } from 'nosskey-iframe';
import type { NostrEvent } from 'nosskey-sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  type NostrProvider,
  formatError,
  nip04Decrypt,
  nip04Encrypt,
  nip04SendDm,
  nip44Decrypt,
  nip44Encrypt,
  signAndPublishNote,
} from './nips.js';

function createNostrMock(): NostrProvider {
  return {
    getPublicKey: vi.fn(),
    signEvent: vi.fn(),
    getRelays: vi.fn(),
    nip44: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    },
    nip04: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    },
  };
}

const PEER = 'a'.repeat(64);

describe('formatError', () => {
  it('formats NosskeyIframeError with its code', () => {
    const err = new NosskeyIframeError('NO_KEY', 'no key registered');
    expect(formatError(err)).toBe('NosskeyIframeError[NO_KEY]: no key registered');
  });

  it('formats generic Error with name and message', () => {
    expect(formatError(new TypeError('boom'))).toBe('TypeError: boom');
  });

  it('stringifies non-Error values', () => {
    expect(formatError('plain string')).toBe('plain string');
  });
});

describe('nip44Encrypt', () => {
  it('returns ciphertext and logs success on the happy path', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip44.encrypt).mockResolvedValue('cipher44');
    const log = vi.fn();
    const result = await nip44Encrypt({ nostr, peer: PEER, plaintext: 'hello', log });
    expect(result).toBe('cipher44');
    expect(nostr.nip44.encrypt).toHaveBeenCalledWith(PEER, 'hello');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('NIP-44 encrypt OK'));
  });

  it('returns null and logs error on failure', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip44.encrypt).mockRejectedValue(new Error('rejected'));
    const log = vi.fn();
    const result = await nip44Encrypt({ nostr, peer: PEER, plaintext: 'hi', log });
    expect(result).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('NIP-44 encrypt failed'));
  });
});

describe('nip44Decrypt', () => {
  it('returns { ok: true, plaintext } on the happy path', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip44.decrypt).mockResolvedValue('plain');
    const log = vi.fn();
    const result = await nip44Decrypt({ nostr, peer: PEER, ciphertext: 'cipher', log });
    expect(result).toEqual({ ok: true, plaintext: 'plain' });
  });

  it('returns { ok: false, message } on failure', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip44.decrypt).mockRejectedValue(new Error('bad mac'));
    const log = vi.fn();
    const result = await nip44Decrypt({ nostr, peer: PEER, ciphertext: 'cipher', log });
    expect(result).toEqual({ ok: false, message: 'Error: bad mac' });
  });
});

describe('nip04Encrypt / nip04Decrypt', () => {
  it('encrypt returns ciphertext on success', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip04.encrypt).mockResolvedValue('cipher04');
    const result = await nip04Encrypt({
      nostr,
      peer: PEER,
      plaintext: 'plain',
      log: vi.fn(),
    });
    expect(result).toBe('cipher04');
  });

  it('decrypt returns { ok: false } when nostr rejects', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip04.decrypt).mockRejectedValue(new Error('mac mismatch'));
    const result = await nip04Decrypt({
      nostr,
      peer: PEER,
      ciphertext: 'cipher',
      log: vi.fn(),
    });
    expect(result).toEqual({ ok: false, message: 'Error: mac mismatch' });
  });
});

describe('signAndPublishNote', () => {
  it('signs a kind:1 draft and publishes the signed event', async () => {
    const nostr = createNostrMock();
    const signed: NostrEvent = {
      kind: 1,
      content: 'hi',
      tags: [],
      created_at: 1700000000,
      pubkey: 'p'.repeat(64),
      id: 'i'.repeat(64),
      sig: 's'.repeat(128),
    };
    vi.mocked(nostr.signEvent).mockResolvedValue(signed);
    const publish = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();
    await signAndPublishNote({
      nostr,
      content: 'hi',
      relayUrl: 'wss://example',
      log,
      publish,
    });
    expect(nostr.signEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 1, content: 'hi', tags: [] })
    );
    expect(publish).toHaveBeenCalledWith(signed);
  });

  it('does not publish when signEvent rejects', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.signEvent).mockRejectedValue(new Error('user rejected'));
    const publish = vi.fn();
    await signAndPublishNote({
      nostr,
      content: 'hi',
      relayUrl: 'wss://example',
      log: vi.fn(),
      publish,
    });
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('nip04SendDm', () => {
  function buildSignedKind4(content: string): NostrEvent {
    return {
      kind: 4,
      content,
      tags: [['p', PEER]],
      created_at: 1700000000,
      pubkey: 'p'.repeat(64),
      id: 'i'.repeat(64),
      sig: 's'.repeat(128),
    };
  }

  it('encrypts, signs a kind:4 with p-tag, calls onCiphertext, then publishes', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip04.encrypt).mockResolvedValue('cipher04');
    vi.mocked(nostr.signEvent).mockResolvedValue(buildSignedKind4('cipher04'));
    const publish = vi.fn().mockResolvedValue(undefined);
    const onCiphertext = vi.fn();
    await nip04SendDm({
      nostr,
      peer: PEER,
      plaintext: 'hello',
      log: vi.fn(),
      publish,
      onCiphertext,
    });
    expect(nostr.nip04.encrypt).toHaveBeenCalledWith(PEER, 'hello');
    expect(onCiphertext).toHaveBeenCalledWith('cipher04');
    expect(nostr.signEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 4, content: 'cipher04', tags: [['p', PEER]] })
    );
    expect(publish).toHaveBeenCalled();
  });

  it('aborts without signing or publishing if encrypt fails', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip04.encrypt).mockRejectedValue(new Error('encrypt failed'));
    const publish = vi.fn();
    const onCiphertext = vi.fn();
    await nip04SendDm({
      nostr,
      peer: PEER,
      plaintext: 'hi',
      log: vi.fn(),
      publish,
      onCiphertext,
    });
    expect(nostr.signEvent).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(onCiphertext).not.toHaveBeenCalled();
  });

  it('does not publish when signEvent fails', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip04.encrypt).mockResolvedValue('cipher04');
    vi.mocked(nostr.signEvent).mockRejectedValue(new Error('user rejected'));
    const publish = vi.fn();
    await nip04SendDm({
      nostr,
      peer: PEER,
      plaintext: 'hi',
      log: vi.fn(),
      publish,
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('works without onCiphertext callback', async () => {
    const nostr = createNostrMock();
    vi.mocked(nostr.nip04.encrypt).mockResolvedValue('cipher04');
    vi.mocked(nostr.signEvent).mockResolvedValue(buildSignedKind4('cipher04'));
    const publish = vi.fn().mockResolvedValue(undefined);
    await nip04SendDm({
      nostr,
      peer: PEER,
      plaintext: 'hi',
      log: vi.fn(),
      publish,
    });
    expect(publish).toHaveBeenCalled();
  });
});
