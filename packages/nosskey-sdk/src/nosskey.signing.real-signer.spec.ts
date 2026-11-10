import { getEventHash, getPublicKey, verify } from '@rx-nostr/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager } from './nosskey.js';
import {
  installWebAuthnMocks,
  mockCredentialId,
  mockPrfResultValue,
} from './nosskey.test-helpers.js';
import type { NostrEvent, NostrKeyInfo } from './types.js';
import { bytesToHex } from './utils.js';

// 署名器をモックしない。呼び出し元が付けた id / sig / pubkey の扱いは署名器の実挙動で
// 決まるため、モックでは退行を検出できない。
describe('signEventWithKeyInfo（実署名器）', () => {
  const secretKeyHex = bytesToHex(new Uint8Array(32).fill(mockPrfResultValue));
  const pubkey = getPublicKey(secretKeyHex);
  const keyInfo: NostrKeyInfo = {
    credentialId: bytesToHex(mockCredentialId),
    pubkey,
    salt: '6e6f7374722d70776b',
  };
  const createdAt = 1_800_000_000;

  let webauthn: ReturnType<typeof installWebAuthnMocks>;

  beforeEach(() => {
    webauthn = installWebAuthnMocks();
  });

  afterEach(() => {
    webauthn.restore();
    vi.clearAllMocks();
  });

  /** 返ったイベントが「この鍵で、この内容に」署名されたものであること。 */
  function expectSignedByKey(signed: NostrEvent, kind: number, content: string): void {
    expect(signed.pubkey).toBe(pubkey);
    expect(signed.kind).toBe(kind);
    expect(signed.content).toBe(content);
    expect(signed.id).toBe(
      getEventHash({
        kind,
        content,
        tags: signed.tags ?? [],
        created_at: signed.created_at ?? 0,
        pubkey,
      })
    );
    expect(verify(signed as Parameters<typeof verify>[0])).toBe(true);
  }

  it('通常のイベントに署名できる', async () => {
    const signed = await new NosskeyManager().signEventWithKeyInfo(
      { kind: 1, content: 'gm', tags: [['t', 'nostr']], created_at: createdAt },
      keyInfo
    );

    expectSignedByKey(signed, 1, 'gm');
    expect(signed.tags).toEqual([['t', 'nostr']]);
    expect(signed.created_at).toBe(createdAt);
  });

  it('呼び出し元が付けた id には署名せず、内容から計算し直す', async () => {
    // 表示される内容とは別のイベントのハッシュを id として紛れ込ませる。
    const other = {
      kind: 0,
      content: JSON.stringify({ name: 'someone else' }),
      tags: [],
      created_at: createdAt,
      pubkey,
    };
    const otherId = getEventHash(other);

    const signed = await new NosskeyManager().signEventWithKeyInfo(
      { kind: 1, content: 'gm', tags: [], created_at: createdAt, id: otherId },
      keyInfo
    );

    expectSignedByKey(signed, 1, 'gm');
    expect(signed.id).not.toBe(otherId);
    // 返った署名は、紛れ込ませた側のイベントには使えない。
    expect(verify({ ...other, id: otherId, sig: signed.sig } as Parameters<typeof verify>[0])).toBe(
      false
    );
  });

  it('呼び出し元が付けた pubkey を使わない', async () => {
    const signed = await new NosskeyManager().signEventWithKeyInfo(
      { kind: 1, content: 'gm', created_at: createdAt, pubkey: 'f'.repeat(64) },
      keyInfo
    );

    expectSignedByKey(signed, 1, 'gm');
  });

  it('id / sig / pubkey が揃ったイベントも素通しせず署名し直す', async () => {
    const forgedSig = '0'.repeat(128);
    const signed = await new NosskeyManager().signEventWithKeyInfo(
      {
        kind: 1,
        content: 'gm',
        tags: [],
        created_at: createdAt,
        id: 'e'.repeat(64),
        sig: forgedSig,
        pubkey: 'f'.repeat(64),
      },
      keyInfo
    );

    expectSignedByKey(signed, 1, 'gm');
    expect(signed.sig).not.toBe(forgedSig);
  });

  it('created_at を省略すると現在時刻で署名する', async () => {
    const before = Math.floor(Date.now() / 1000);
    const signed = await new NosskeyManager().signEventWithKeyInfo(
      { kind: 1, content: 'gm' },
      keyInfo
    );

    expectSignedByKey(signed, 1, 'gm');
    expect(signed.created_at).toBeGreaterThanOrEqual(before);
  });

  it('options.tags は従来どおり末尾に追加される', async () => {
    const signed = await new NosskeyManager().signEventWithKeyInfo(
      { kind: 1, content: 'gm', tags: [['t', 'a']], created_at: createdAt },
      keyInfo,
      { tags: [['client', 'nosskey']] }
    );

    expectSignedByKey(signed, 1, 'gm');
    expect(signed.tags).toEqual([
      ['t', 'a'],
      ['client', 'nosskey'],
    ]);
  });

  it('不正なイベントはパスキー認証を求める前に拒否する', async () => {
    const manager = new NosskeyManager();

    await expect(
      manager.signEventWithKeyInfo({ kind: 1.5, content: 'gm' }, keyInfo)
    ).rejects.toThrow('kind');
    await expect(
      manager.signEventWithKeyInfo(
        { kind: 1, content: 'gm', tags: [['t', 1]] } as unknown as NostrEvent,
        keyInfo
      )
    ).rejects.toThrow('tags');
    expect(navigator.credentials.get).not.toHaveBeenCalled();
  });

  it('signEvent（現在の鍵）経由でも同じく id を無視する', async () => {
    const manager = new NosskeyManager({ storageOptions: { enabled: false } });
    manager.setCurrentKeyInfo(keyInfo);

    const signed = await manager.signEvent({
      kind: 1,
      content: 'gm',
      created_at: createdAt,
      id: 'e'.repeat(64),
    });

    expectSignedByKey(signed, 1, 'gm');
  });
});
