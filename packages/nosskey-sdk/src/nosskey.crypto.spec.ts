import { seckeySigner } from '@rx-nostr/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager } from './nosskey.js';
import {
  installWebAuthnMocks,
  mockCredentialId,
  mockPrfResultValue,
} from './nosskey.test-helpers.js';
import type { NostrKeyInfo } from './types.js';
import { bytesToHex, hexToBytes } from './utils.js';

vi.mock('@rx-nostr/crypto', () => {
  return {
    seckeySigner: vi.fn(() => ({
      signEvent: vi.fn(async (event) => ({
        ...event,
        id: 'test-event-id',
        sig: 'test-signature',
      })),
      getPublicKey: vi.fn(async () => 'test-pubkey'),
    })),
  };
});

describe('NosskeyManager', () => {
  let webauthn: ReturnType<typeof installWebAuthnMocks>;

  beforeEach(() => {
    webauthn = installWebAuthnMocks();
  });

  afterEach(() => {
    webauthn.restore();
    vi.clearAllMocks();
  });

  describe('salt の導出への利用と正規化', () => {
    it('signEventWithKeyInfo は keyInfo.salt をPRF評価入力として getPrfSecret に渡す', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const keyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      await nosskey.signEventWithKeyInfo({ kind: 1, content: 'test', tags: [] }, keyInfo);

      expect(getPrfSecretSpy.mock.calls[0][2]).toEqual(hexToBytes('6e6f7374722d70776b'));
    });

    it('旧salt値 (6e6f7374722d6b6579) は標準値へ正規化して導出に使われる', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const legacyKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      await nosskey.signEventWithKeyInfo({ kind: 1, content: 'test', tags: [] }, legacyKeyInfo);

      expect(getPrfSecretSpy.mock.calls[0][2]).toEqual(hexToBytes('6e6f7374722d70776b'));
    });

    it('salt 未設定の keyInfo も標準値へ正規化して導出に使われる', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const keyInfoWithoutSalt = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
      } as NostrKeyInfo;

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      await nosskey.signEventWithKeyInfo(
        { kind: 1, content: 'test', tags: [] },
        keyInfoWithoutSalt
      );

      expect(getPrfSecretSpy.mock.calls[0][2]).toEqual(hexToBytes('6e6f7374722d70776b'));
    });

    it('キャッシュ有効時の直接モードでも exportNostrKey は毎回 UV を要求する', async () => {
      const nosskey = new NosskeyManager({
        cacheOptions: { enabled: true },
        storageOptions: { enabled: false },
      });
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy
        .mockResolvedValueOnce({ secret: new Uint8Array(32).fill(42), id: mockCredentialId })
        .mockResolvedValueOnce({ secret: new Uint8Array(32).fill(42), id: mockCredentialId });

      try {
        await nosskey.exportNostrKey(mockKeyInfo);
        expect(getPrfSecretSpy).toHaveBeenCalledTimes(1);

        // キャッシュ TTL 内でも2回目の export は UV を要求する
        await nosskey.exportNostrKey(mockKeyInfo);
        expect(getPrfSecretSpy).toHaveBeenCalledTimes(2);
      } finally {
        getPrfSecretSpy.mockRestore();
      }
    });

    it('exportNostrKey はキャッシュを汚染しない（export 後の sign は UV を要求する）', async () => {
      const nosskey = new NosskeyManager({
        cacheOptions: { enabled: true },
        storageOptions: { enabled: false },
      });
      const mockKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy
        .mockResolvedValueOnce({ secret: new Uint8Array(32).fill(42), id: mockCredentialId })
        .mockResolvedValueOnce({ secret: new Uint8Array(32).fill(42), id: mockCredentialId });

      try {
        // export はキャッシュに書き込まない（bypassCache=true は read/write 両方をスキップ）
        await nosskey.exportNostrKey(mockKeyInfo);
        expect(getPrfSecretSpy).toHaveBeenCalledTimes(1);

        // export 後にキャッシュが空のため、sign は UV を要求する
        const mockEvent = { kind: 1, content: 'x', tags: [], created_at: 0, pubkey: 'test-pubkey' };
        await nosskey.signEventWithKeyInfo(mockEvent, mockKeyInfo);
        expect(getPrfSecretSpy).toHaveBeenCalledTimes(2);
      } finally {
        getPrfSecretSpy.mockRestore();
      }
    });

    it('exportNostrKey は旧salt値を標準値へ正規化して getPrfSecret に渡す', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
      const legacyKeyInfo: NostrKeyInfo = {
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d6b6579',
      };

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      await nosskey.exportNostrKey(legacyKeyInfo);

      expect(getPrfSecretSpy.mock.calls[0][2]).toEqual(hexToBytes('6e6f7374722d70776b'));
    });
  });

  describe('NIP-44 / NIP-04 暗号化メソッド', () => {
    // The PRF mock returns 32 bytes of 0x2a, which is a valid secp256k1 scalar.
    // We pair it with a peer pubkey derived from a known private key.
    const peerSecret = new Uint8Array(32).fill(0x33);
    let peerPubHex: string;

    beforeEach(async () => {
      const { schnorr } = await import('@noble/curves/secp256k1.js');
      peerPubHex = bytesToHex(schnorr.getPublicKey(peerSecret));
    });

    it('nip44Encrypt / nip44Decrypt のラウンドトリップ', async () => {
      const nosskey = new NosskeyManager();
      nosskey.setCurrentKeyInfo({
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
      });

      const ciphertext = await nosskey.nip44Encrypt(peerPubHex, 'こんにちは 🌸');
      // Decrypt from the peer's perspective to validate the payload is well-formed.
      const { schnorr } = await import('@noble/curves/secp256k1.js');
      const ourSk = new Uint8Array(32).fill(mockPrfResultValue);
      const ourPubHex = bytesToHex(schnorr.getPublicKey(ourSk));
      const { nip44Decrypt } = await import('./nip44.js');
      expect(nip44Decrypt(ciphertext, peerSecret, ourPubHex)).toBe('こんにちは 🌸');

      // And decrypting back through NosskeyManager works.
      expect(await nosskey.nip44Decrypt(peerPubHex, ciphertext)).toBe('こんにちは 🌸');
    });

    it('nip04Encrypt / nip04Decrypt のラウンドトリップ', async () => {
      const nosskey = new NosskeyManager();
      nosskey.setCurrentKeyInfo({
        credentialId: bytesToHex(mockCredentialId),
        pubkey: 'test-pubkey',
        salt: '6e6f7374722d70776b',
      });

      const ciphertext = await nosskey.nip04Encrypt(peerPubHex, 'hello legacy DM');
      expect(ciphertext).toMatch(/\?iv=/);
      expect(await nosskey.nip04Decrypt(peerPubHex, ciphertext)).toBe('hello legacy DM');
    });

    it('NostrKeyInfo 未設定だと nip44Encrypt はエラー', async () => {
      const nosskey = new NosskeyManager();
      vi.spyOn(nosskey, 'getCurrentKeyInfo').mockReturnValue(null);
      await expect(nosskey.nip44Encrypt(peerPubHex, 'x')).rejects.toThrow(
        'No current NostrKeyInfo set'
      );
    });

    it('NostrKeyInfo 未設定だと nip04Decrypt はエラー', async () => {
      const nosskey = new NosskeyManager();
      vi.spyOn(nosskey, 'getCurrentKeyInfo').mockReturnValue(null);
      await expect(nosskey.nip04Decrypt(peerPubHex, 'foo?iv=bar')).rejects.toThrow(
        'No current NostrKeyInfo set'
      );
    });
  });

  /**
   * wrap モードの実値テスト群。
   *
   * 既存テストは `@rx-nostr/crypto` 全モックで `seckeySigner.getPublicKey()` を固定値
   * `'test-pubkey'` に潰しているため、`nip44Encrypt` の peerPk が 32B hex でなく ECDH が
   * 失敗する。この describe 内では `seckeySigner` を「sk hex から本物の secp256k1 x-only
   * pubkey を計算する実装」に差し替え、`nip44Encrypt`/`nip44Decrypt` は本物を走らせる
   * （`./nip44.js` はそもそも全モックの対象外）。
   *
   * テストベクトル戦略: nip44Encrypt の `nonceOverride` で固定 nonce 生成した payload を
   * 「事前生成済みの wrapped payload」として復号テストに使い、復号結果が元の seckey と
   * バイト一致することで実値ラウンドトリップを担保する。
   */
});
