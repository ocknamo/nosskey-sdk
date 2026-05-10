import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { type NostrEvent, bytesToHex, hexToBytes, nip44Decrypt, nip44Encrypt } from 'nosskey-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRumor, jitteredTimestamp, sendNip17Dm, signEphemeralEvent } from './nip17.js';

function freshKeypair(): { secret: Uint8Array; pubkey: string } {
  const secret = schnorr.utils.randomSecretKey();
  const pubkey = bytesToHex(schnorr.getPublicKey(secret));
  return { secret, pubkey };
}

function canonicalEventId(ev: NostrEvent): string {
  const serialized = JSON.stringify([
    0,
    ev.pubkey,
    ev.created_at,
    ev.kind,
    ev.tags ?? [],
    ev.content,
  ]);
  return bytesToHex(sha256(new TextEncoder().encode(serialized)));
}

describe('jitteredTimestamp', () => {
  it('returns a value in [now - 2 days, now]', () => {
    const now = 1_700_000_000;
    const twoDays = 2 * 24 * 60 * 60;
    for (let i = 0; i < 50; i++) {
      const ts = jitteredTimestamp(now);
      expect(ts).toBeLessThanOrEqual(now);
      expect(ts).toBeGreaterThanOrEqual(now - twoDays);
    }
  });

  it('defaults to a near-current timestamp when called without an argument', () => {
    const before = Math.floor(Date.now() / 1000);
    const ts = jitteredTimestamp();
    const after = Math.floor(Date.now() / 1000);
    expect(ts).toBeLessThanOrEqual(after);
    expect(ts).toBeGreaterThanOrEqual(before - 2 * 24 * 60 * 60);
  });
});

describe('buildRumor', () => {
  it('produces a kind:14 unsigned event with sender pubkey and a single p tag', () => {
    const sender = freshKeypair().pubkey;
    const peer = freshKeypair().pubkey;
    const rumor = buildRumor(sender, peer, 'hello');

    expect(rumor.kind).toBe(14);
    expect(rumor.pubkey).toBe(sender);
    expect(rumor.tags).toEqual([['p', peer]]);
    expect(rumor.content).toBe('hello');
    expect(rumor.id).toMatch(/^[0-9a-f]{64}$/);
    // Rumors are NEVER signed per NIP-59.
    expect(rumor.sig).toBeUndefined();
  });

  it('computes the id from the canonical NIP-01 serialization', () => {
    const sender = freshKeypair().pubkey;
    const peer = freshKeypair().pubkey;
    const rumor = buildRumor(sender, peer, 'canonical check');

    expect(rumor.id).toBe(canonicalEventId(rumor));
  });

  it('preserves non-ASCII content unescaped (NIP-01 §id requires raw UTF-8)', () => {
    const { pubkey: sender } = freshKeypair();
    const { pubkey: peer } = freshKeypair();
    const content = 'hello, NIP-17 🎁';
    const rumor = buildRumor(sender, peer, content);

    // Recompute the id using JSON.stringify directly — it must match the
    // helper's output, which proves we're not double-escaping the emoji.
    expect(rumor.id).toBe(canonicalEventId(rumor));
    expect(rumor.content).toBe(content);
  });
});

describe('signEphemeralEvent', () => {
  it('fills pubkey and id, and produces a verifying schnorr signature', () => {
    const { secret, pubkey } = freshKeypair();
    const draft = {
      kind: 1059,
      created_at: 1_700_000_000,
      tags: [['p', freshKeypair().pubkey]],
      content: 'gift wrap content',
    };

    const signed = signEphemeralEvent(draft, secret);

    expect(signed.kind).toBe(1059);
    expect(signed.created_at).toBe(draft.created_at);
    expect(signed.tags).toEqual(draft.tags);
    expect(signed.content).toBe(draft.content);
    expect(signed.pubkey).toBe(pubkey);
    expect(signed.id).toBe(canonicalEventId(signed));
    expect(signed.sig).toMatch(/^[0-9a-f]{128}$/);

    // BIP340 verification: sig must validate against (id, pubkey).
    expect(
      schnorr.verify(
        hexToBytes(signed.sig as string),
        hexToBytes(signed.id as string),
        hexToBytes(pubkey)
      )
    ).toBe(true);
  });

  it('produces signatures bound to the event id (mutated content fails verification)', () => {
    const { secret, pubkey } = freshKeypair();
    const signed = signEphemeralEvent(
      { kind: 1, created_at: 0, tags: [], content: 'original' },
      secret
    );

    const tamperedId = canonicalEventId({ ...signed, content: 'tampered' } as NostrEvent);
    expect(tamperedId).not.toBe(signed.id);
    expect(
      schnorr.verify(hexToBytes(signed.sig as string), hexToBytes(tamperedId), hexToBytes(pubkey))
    ).toBe(false);
  });
});

describe('sendNip17Dm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('orchestrates rumor → seal → gift wrap and decrypts back to the rumor', async () => {
    const sender = freshKeypair();
    const recipient = freshKeypair();
    const plaintext = 'hello, NIP-17 🎁';

    // The seal layer normally goes through the iframe (NIP-44 with the
    // user's Nosskey + signEvent). Here we satisfy those callbacks with the
    // sender's plain key so the test can decrypt the seal end-to-end.
    const sealEncrypt = vi.fn(async (peer: string, plain: string) =>
      nip44Encrypt(plain, sender.secret, peer)
    );
    const signSeal = vi.fn(async (draft: NostrEvent) => {
      const filled = { ...draft, pubkey: sender.pubkey };
      const id = canonicalEventId(filled);
      const sig = bytesToHex(schnorr.sign(hexToBytes(id), sender.secret));
      return { ...filled, id, sig };
    });
    const publish = vi.fn(async (_event: NostrEvent) => undefined);

    const result = await sendNip17Dm({
      senderPubkey: sender.pubkey,
      peerPubkey: recipient.pubkey,
      plaintext,
      sealEncrypt,
      signSeal,
      publish,
    });

    // sealEncrypt was called with the recipient pubkey and the rumor JSON.
    expect(sealEncrypt).toHaveBeenCalledTimes(1);
    const [encryptedPeer, encryptedPlain] = sealEncrypt.mock.calls[0];
    expect(encryptedPeer).toBe(recipient.pubkey);
    const rumorParsed = JSON.parse(encryptedPlain) as NostrEvent;
    expect(rumorParsed.kind).toBe(14);
    expect(rumorParsed.pubkey).toBe(sender.pubkey);
    expect(rumorParsed.tags).toEqual([['p', recipient.pubkey]]);
    expect(rumorParsed.content).toBe(plaintext);
    expect(rumorParsed.sig).toBeUndefined();

    // signSeal was called with a kind:13 draft, empty tags, jittered ts.
    expect(signSeal).toHaveBeenCalledTimes(1);
    const sealDraft = signSeal.mock.calls[0][0];
    const now = Math.floor(Date.now() / 1000);
    expect(sealDraft.kind).toBe(13);
    expect(sealDraft.tags).toEqual([]);
    expect(sealDraft.content).toBe(await sealEncrypt.mock.results[0].value);
    expect(sealDraft.created_at).toBeLessThanOrEqual(now + 1);
    expect(sealDraft.created_at).toBeGreaterThanOrEqual(now - 2 * 24 * 60 * 60);

    // publish was called with the gift wrap returned in result.
    expect(publish).toHaveBeenCalledTimes(1);
    const published = publish.mock.calls[0][0];
    expect(published).toBe(result.giftWrap);
    expect(published.kind).toBe(1059);
    expect(published.tags).toEqual([['p', recipient.pubkey]]);
    expect(published.pubkey).toBe(result.ephemeralPubkey);
    expect(published.created_at).toBeLessThanOrEqual(now + 1);
    expect(published.created_at).toBeGreaterThanOrEqual(now - 2 * 24 * 60 * 60);

    // The gift wrap signature verifies against the ephemeral pubkey.
    expect(
      schnorr.verify(
        hexToBytes(published.sig as string),
        hexToBytes(published.id as string),
        hexToBytes(result.ephemeralPubkey)
      )
    ).toBe(true);

    // Recipient-side decryption: peel the gift wrap, then the seal, then
    // recover the original rumor with the original plaintext.
    const sealJson = nip44Decrypt(published.content, recipient.secret, result.ephemeralPubkey);
    const seal = JSON.parse(sealJson) as NostrEvent;
    expect(seal.kind).toBe(13);
    expect(seal.pubkey).toBe(sender.pubkey);

    const rumorJson = nip44Decrypt(seal.content, recipient.secret, sender.pubkey);
    const recoveredRumor = JSON.parse(rumorJson) as NostrEvent;
    expect(recoveredRumor.kind).toBe(14);
    expect(recoveredRumor.pubkey).toBe(sender.pubkey);
    expect(recoveredRumor.content).toBe(plaintext);
    expect(recoveredRumor.tags).toEqual([['p', recipient.pubkey]]);
  });

  it('propagates seal-encryption failure without calling signSeal or publish', async () => {
    const sender = freshKeypair();
    const recipient = freshKeypair();
    const sealEncrypt = vi.fn(async () => {
      throw new Error('user rejected');
    });
    const signSeal = vi.fn();
    const publish = vi.fn();

    await expect(
      sendNip17Dm({
        senderPubkey: sender.pubkey,
        peerPubkey: recipient.pubkey,
        plaintext: 'x',
        sealEncrypt,
        signSeal,
        publish,
      })
    ).rejects.toThrow('user rejected');

    expect(signSeal).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
