import { seckeySigner } from '@rx-nostr/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager, PENDING_PRF_TTL_MS } from './nosskey.js';
import {
  installWebAuthnMocks,
  mockCredentialId,
  mockPrfResultValue,
} from './nosskey.test-helpers.js';
import type { NostrEvent, NostrKeyInfo } from './types.js';
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

  describe('isPrfSupported', () => {
    it('PRF拡張が利用可能な場合にtrueを返す', async () => {
      const nosskey = new NosskeyManager();
      const result = await nosskey.isPrfSupported();
      expect(result).toBe(true);
      expect(navigator.credentials.get).toHaveBeenCalled();
    });

    it('例外発生時にfalseを返す', async () => {
      // エラーを投げるようにモックを変更
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => {
            throw new Error('Not supported');
          }),
        },
        configurable: true,
      });

      const nosskey = new NosskeyManager();
      const result = await nosskey.isPrfSupported();
      expect(result).toBe(false);
    });
  });

  describe('createPasskey', () => {
    it('パスキーを作成してCredentialIDを返す', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = await nosskey.createPasskey();

      expect(credentialId).toBeInstanceOf(Uint8Array);
      expect(credentialId.length).toBeGreaterThan(0);
      expect(navigator.credentials.create).toHaveBeenCalled();
    });

    it('create 時に標準 salt と wrap salt の両方を PRF eval に渡す', async () => {
      const nosskey = new NosskeyManager();
      await nosskey.createPasskey();

      const callArgs = (navigator.credentials.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const prfEval = callArgs.publicKey.extensions.prf.eval;
      // first = "nostr-pwk", second = "nostr-pwk-wrap"
      expect(prfEval.first).toEqual(hexToBytes('6e6f7374722d70776b'));
      expect(prfEval.second).toEqual(hexToBytes('6e6f7374722d70776b2d77726170'));
    });
  });

  describe('createPasskey からの PRF キャッシュ', () => {
    // create 時に first/second 両方の PRF を返す mock。get は呼ばれたら失敗させ、
    // 「キャッシュ経路で UV が 1 回も追加発生しないこと」を保証する。
    beforeEach(async () => {
      // importNostrKey は実物 nip44Encrypt が動くため、kek からの公開鍵が有効な
      // 32 バイト x 座標である必要がある。top-level の seckeySigner mock は
      // 'test-pubkey' を返すので、ここでは secp256k1 schnorr で実値の公開鍵を
      // 返すよう差し替える。
      const { schnorr } = await import('@noble/curves/secp256k1.js');
      vi.mocked(seckeySigner).mockImplementation(
        (skHex: string) =>
          ({
            getPublicKey: async () => bytesToHex(schnorr.getPublicKey(hexToBytes(skHex))),
            signEvent: vi.fn(),
          }) as unknown as ReturnType<typeof seckeySigner>
      );

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: vi.fn(async () => ({
            rawId: mockCredentialId.buffer,
            getClientExtensionResults: vi.fn(() => ({
              prf: {
                results: {
                  first: new Uint8Array(32).fill(mockPrfResultValue).buffer,
                  second: new Uint8Array(32).fill(mockPrfResultValue + 1).buffer,
                },
              },
            })),
          })),
          get: vi.fn(async () => {
            throw new Error('navigator.credentials.get should not be called');
          }),
        },
        configurable: true,
      });
    });

    afterEach(() => {
      // top-level vi.mock 由来の seckeySigner 挙動に戻す
      // (clearAllMocks では mockImplementation は維持されるため、ここで明示復元)
      vi.mocked(seckeySigner).mockImplementation(
        () =>
          ({
            signEvent: vi.fn(async (event: NostrEvent) => ({
              ...event,
              id: 'test-event-id',
              sig: 'test-signature',
            })),
            getPublicKey: vi.fn(async () => 'test-pubkey'),
          }) as unknown as ReturnType<typeof seckeySigner>
      );
    });

    it('createPasskey 直後の createNostrKey は get() を呼ばずキャッシュを消費する', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = await nosskey.createPasskey();

      const keyInfo = await nosskey.createNostrKey(credentialId);

      expect(keyInfo.salt).toBe('6e6f7374722d70776b');
      expect(navigator.credentials.get).not.toHaveBeenCalled();
    });

    it('createPasskey 直後の importNostrKey は get() を呼ばずキャッシュを消費する', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = await nosskey.createPasskey();

      const seckey = new Uint8Array(32).fill(7);
      const keyInfo = await nosskey.importNostrKey(seckey, credentialId);

      expect(keyInfo.wrapped).toBeDefined();
      expect(keyInfo.salt).toBe('6e6f7374722d70776b2d77726170');
      expect(navigator.credentials.get).not.toHaveBeenCalled();
    });

    it('createNostrKey が standard を消費したら相方の wrap キャッシュも破棄される', async () => {
      // 正常運用は片方しか呼ばれない（新規=createNostrKey または 既存=importNostrKey）。
      // 未消費の相方 PRF を heap に残さないことの担保。standard 消費後に
      // importNostrKey を呼ぶと get() フォールバックに切り替わるはず。
      const nosskey = new NosskeyManager();
      const credentialId = await nosskey.createPasskey();

      await nosskey.createNostrKey(credentialId);

      // get を wrap salt 用 PRF を返すよう差し替え（mockCredential は first のみ持つので
      // ここでは「呼ばれた回数」を主眼に確認）
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: navigator.credentials.create,
          get: vi.fn(async () => ({
            rawId: credentialId.buffer,
            getClientExtensionResults: vi.fn(() => ({
              prf: {
                results: { first: new Uint8Array(32).fill(mockPrfResultValue + 1).buffer },
              },
            })),
          })),
        },
        configurable: true,
      });

      const seckey = new Uint8Array(32).fill(7);
      await nosskey.importNostrKey(seckey, credentialId);

      // wrap キャッシュが破棄されているので getPrfSecret 経由になる
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    });

    it('一度消費したキャッシュは次回 get() フォールバックに切り替わる', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = await nosskey.createPasskey();

      // 1 回目: キャッシュ消費（get は呼ばれない）
      await nosskey.createNostrKey(credentialId);

      // 2 回目に備えて get を本来の挙動に戻す。標準 salt 由来 PRF を返す。
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: navigator.credentials.create,
          get: vi.fn(async () => ({
            rawId: credentialId.buffer,
            getClientExtensionResults: vi.fn(() => ({
              prf: {
                results: { first: new Uint8Array(32).fill(mockPrfResultValue).buffer },
              },
            })),
          })),
        },
        configurable: true,
      });

      await nosskey.createNostrKey(credentialId);
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    });

    it('未消費のまま TTL が経過したキャッシュはゼロ化され get() フォールバックに切り替わる', async () => {
      vi.useFakeTimers();
      try {
        const nosskey = new NosskeyManager();
        const credentialId = await nosskey.createPasskey();

        // TTL 経過で自動掃除されるはず
        vi.advanceTimersByTime(PENDING_PRF_TTL_MS);

        // get を本来の挙動に戻す（キャッシュが残っていれば呼ばれないので検出できる）
        Object.defineProperty(globalThis.navigator, 'credentials', {
          value: {
            create: navigator.credentials.create,
            get: vi.fn(async () => ({
              rawId: credentialId.buffer,
              getClientExtensionResults: vi.fn(() => ({
                prf: {
                  results: { first: new Uint8Array(32).fill(mockPrfResultValue).buffer },
                },
              })),
            })),
          },
          configurable: true,
        });

        await nosskey.createNostrKey(credentialId);
        expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('TTL 満了時は未消費の PRF バッファ自体が fill(0) でゼロ化される', async () => {
      // prf-handler は extension results の ArrayBuffer を new Uint8Array(buf) で
      // ビュー化する（コピーしない）ため、テスト側で同じ ArrayBuffer への参照を
      // 保持すれば SDK 内部のゼロ化が実効しているかを直接観測できる。
      const firstBuf = new Uint8Array(32).fill(mockPrfResultValue).buffer;
      const secondBuf = new Uint8Array(32).fill(mockPrfResultValue + 1).buffer;
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: vi.fn(async () => ({
            rawId: mockCredentialId.buffer,
            getClientExtensionResults: vi.fn(() => ({
              prf: { results: { first: firstBuf, second: secondBuf } },
            })),
          })),
          get: vi.fn(async () => {
            throw new Error('navigator.credentials.get should not be called');
          }),
        },
        configurable: true,
      });

      vi.useFakeTimers();
      try {
        const nosskey = new NosskeyManager();
        await nosskey.createPasskey();

        // TTL 満了前は秘密値が残っている（前提確認）
        expect(new Uint8Array(firstBuf).every((b) => b === 0)).toBe(false);
        expect(new Uint8Array(secondBuf).every((b) => b === 0)).toBe(false);

        vi.advanceTimersByTime(PENDING_PRF_TTL_MS);

        // Map からの削除だけでなく、バッファ自体がゼロ化されている
        expect(new Uint8Array(firstBuf).every((b) => b === 0)).toBe(true);
        expect(new Uint8Array(secondBuf).every((b) => b === 0)).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('clearCurrentKeyInfo()（ログアウト）は未消費 PRF キャッシュも破棄する', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = await nosskey.createPasskey();

      nosskey.clearCurrentKeyInfo();

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: navigator.credentials.create,
          get: vi.fn(async () => ({
            rawId: credentialId.buffer,
            getClientExtensionResults: vi.fn(() => ({
              prf: {
                results: { first: new Uint8Array(32).fill(mockPrfResultValue).buffer },
              },
            })),
          })),
        },
        configurable: true,
      });

      await nosskey.createNostrKey(credentialId);
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    });

    it('credentialId 引数を省略した createNostrKey はキャッシュを照合せず get() にフォールバック', async () => {
      const nosskey = new NosskeyManager();
      await nosskey.createPasskey();

      // get を本来の挙動に戻す
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: navigator.credentials.create,
          get: vi.fn(async () => ({
            rawId: mockCredentialId.buffer,
            getClientExtensionResults: vi.fn(() => ({
              prf: {
                results: { first: new Uint8Array(32).fill(mockPrfResultValue).buffer },
              },
            })),
          })),
        },
        configurable: true,
      });

      await nosskey.createNostrKey();
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('createNostrKey', () => {
    it('PRF値を直接Nostrシークレットキーとして使用できる', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = new Uint8Array(16).fill(1);

      const result = await nosskey.createNostrKey(credentialId);

      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('pubkey');
      expect(result).toHaveProperty('salt');
      expect(result.pubkey).toBe('test-pubkey');
      expect(result.salt).toBe('6e6f7374722d70776b'); // "nostr-pwk"のhex
    });

    it('prfOptionsを指定してPRF取得をカスタマイズできる', async () => {
      const nosskey = new NosskeyManager({
        prfOptions: {
          rpId: 'example.com',
          timeout: 60000,
          userVerification: 'preferred',
        },
      });
      const credentialId = new Uint8Array(16).fill(1);

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');

      await nosskey.createNostrKey(credentialId);

      expect(getPrfSecretSpy).toHaveBeenCalledWith(
        credentialId,
        {
          rpId: 'example.com',
          timeout: 60000,
          userVerification: 'preferred',
          residentKey: 'required',
          requireResidentKey: true,
        },
        hexToBytes('6e6f7374722d70776b')
      );
    });

    it('PRF値がゼロの場合はエラーを投げる', async () => {
      const nosskey = new NosskeyManager();
      const credentialId = new Uint8Array(16).fill(1);

      // PRFの結果がすべて0の場合をモック
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => ({
            rawId: credentialId.buffer,
            getClientExtensionResults: vi.fn(() => ({
              prf: {
                results: {
                  first: new Uint8Array(32).fill(0).buffer,
                },
              },
            })),
          })),
        },
        configurable: true,
      });

      await expect(nosskey.createNostrKey(credentialId)).rejects.toThrow('Invalid PRF output');
    });
  });

  describe('createNostrKey with username オプション', () => {
    // NOTE: 既存の `signEventWithKeyInfo` テストで共有 `mockPrfResult` ArrayBuffer が
    // fill(0) 汚染されるため、getPrfSecret を直接 spyOn で差し替えて独立した Uint8Array を返す
    it('usernameを指定するとNostrKeyInfoにusernameが含まれる', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      const result = await nosskey.createNostrKey(mockCredentialId, { username: 'alice' });

      expect(result.username).toBe('alice');
    });

    it('usernameを省略するとNostrKeyInfoにusernameプロパティが含まれない', async () => {
      const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });

      const getPrfSecretSpy = vi.spyOn(await import('./prf-handler.js'), 'getPrfSecret');
      getPrfSecretSpy.mockResolvedValueOnce({
        secret: new Uint8Array(32).fill(42),
        id: mockCredentialId,
      });

      const result = await nosskey.createNostrKey(mockCredentialId);

      expect('username' in result).toBe(false);
    });
  });
});
