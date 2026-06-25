import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPasskey, isPrfSupported } from './prf-handler.js';
import { installPrfMocks } from './prf-handler.test-helpers.js';
import type { PasskeyCreationOptions } from './types.js';

describe('prf-handler', () => {
  let prfMocks: ReturnType<typeof installPrfMocks>;

  beforeEach(() => {
    prfMocks = installPrfMocks();
  });

  afterEach(() => {
    prfMocks.restore();
    vi.clearAllMocks();
  });

  describe('isPrfSupported', () => {
    it('PRF拡張が利用可能な場合にtrueを返す', async () => {
      const mockCredential = {
        getClientExtensionResults: vi.fn(() => ({
          prf: {
            results: {
              first: new Uint8Array(32).fill(42).buffer,
            },
          },
        })),
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockCredential),
        },
        configurable: true,
      });

      const result = await isPrfSupported();

      expect(result).toBe(true);
      expect(navigator.credentials.get).toHaveBeenCalledWith({
        publicKey: {
          challenge: expect.any(Uint8Array),
          allowCredentials: [],
          userVerification: 'required',
          extensions: { prf: { eval: { first: expect.any(Uint8Array) } } },
        },
      });
    });

    it('レスポンスがnullの場合にfalseを返す', async () => {
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => null),
        },
        configurable: true,
      });

      const result = await isPrfSupported();
      expect(result).toBe(false);
    });

    it('PRF結果がない場合にfalseを返す', async () => {
      const mockCredential = {
        getClientExtensionResults: vi.fn(() => ({
          prf: {
            results: {}, // firstがない
          },
        })),
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockCredential),
        },
        configurable: true,
      });

      const result = await isPrfSupported();
      expect(result).toBe(false);
    });

    it('prf拡張結果がない場合にfalseを返す', async () => {
      const mockCredential = {
        getClientExtensionResults: vi.fn(() => ({})), // prfがない
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockCredential),
        },
        configurable: true,
      });

      const result = await isPrfSupported();
      expect(result).toBe(false);
    });

    it('例外が発生した場合にfalseを返す', async () => {
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => {
            throw new Error('WebAuthn not supported');
          }),
        },
        configurable: true,
      });

      const result = await isPrfSupported();
      expect(result).toBe(false);
    });

    it('正しい入力値でPRF拡張を呼び出す', async () => {
      const mockCredential = {
        getClientExtensionResults: vi.fn(() => ({
          prf: { results: { first: new ArrayBuffer(32) } },
        })),
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockCredential),
        },
        configurable: true,
      });

      await isPrfSupported();

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const prfEval = callArgs.publicKey.extensions.prf.eval.first;

      // PRF評価入力値が正しいことを確認
      expect(prfEval).toEqual(new TextEncoder().encode('nostr-pwk'));
    });
  });

  describe('createPasskey', () => {
    let mockCredential: Partial<PublicKeyCredential>;

    beforeEach(() => {
      mockCredential = {
        id: 'test-credential-id',
        rawId: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
        type: 'public-key',
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: vi.fn(async () => mockCredential),
        },
        configurable: true,
      });
    });

    it('デフォルトオプションでパスキーを作成できる', async () => {
      // locationをモック
      Object.defineProperty(globalThis, 'location', {
        value: { host: 'example.com' },
        configurable: true,
      });

      const result = await createPasskey();

      expect(result.id).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
      expect(navigator.credentials.create).toHaveBeenCalled();

      const callArgs = (navigator.credentials.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const publicKey = callArgs.publicKey;

      expect(publicKey.rp.name).toBe('example.com');
      expect(publicKey.user.name).toBe('user@example.com');
      expect(publicKey.user.displayName).toBe('Nosskey user');
      // デフォルトでも create 時に PRF eval を仕掛ける（first = "nostr-pwk"）
      expect(publicKey.extensions.prf.eval.first).toEqual(new TextEncoder().encode('nostr-pwk'));
      expect(publicKey.extensions.prf.eval.second).toBeUndefined();
    });

    it('Node環境（location未定義）でも動作する', async () => {
      // locationを未定義にする
      Object.defineProperty(globalThis, 'location', {
        value: undefined,
        configurable: true,
      });

      const result = await createPasskey();

      expect(result.id).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

      const callArgs = (navigator.credentials.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.publicKey.rp.name).toBe('Nosskey');
    });

    it('カスタムオプションを適用できる', async () => {
      const options: PasskeyCreationOptions = {
        rp: {
          name: 'My App',
          id: 'myapp.com',
        },
        user: {
          name: 'test@example.com',
          displayName: 'Test User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -8 }, // EdDSA
          { type: 'public-key', alg: -7 }, // ES256
        ],
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
        extensions: {
          prf: {},
          credProps: true,
        },
      };

      await createPasskey(options);

      const callArgs = (navigator.credentials.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const publicKey = callArgs.publicKey;

      expect(publicKey.rp.name).toBe('My App');
      expect(publicKey.rp.id).toBe('myapp.com');
      expect(publicKey.user.name).toBe('test@example.com');
      expect(publicKey.user.displayName).toBe('Test User');
      expect(publicKey.pubKeyCredParams).toEqual([
        { type: 'public-key', alg: -8 },
        { type: 'public-key', alg: -7 },
      ]);
      expect(publicKey.authenticatorSelection).toEqual({
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      });
      expect(publicKey.extensions).toEqual({
        prf: {},
        credProps: true,
      });
    });

    it('rpIdが指定されていない場合は省略される', async () => {
      const options: PasskeyCreationOptions = {
        rp: {
          name: 'Test App',
          // id を指定しない
        },
      };

      await createPasskey(options);

      const callArgs = (navigator.credentials.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const rp = callArgs.publicKey.rp;

      expect(rp.name).toBe('Test App');
      expect(rp.id).toBeUndefined();
    });

    it('ランダムなユーザーIDとチャレンジが生成される', async () => {
      await createPasskey();

      const callArgs = (navigator.credentials.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const publicKey = callArgs.publicKey;

      expect(publicKey.user.id).toBeInstanceOf(Uint8Array);
      expect(publicKey.user.id.length).toBe(16);
      expect(publicKey.challenge).toBeInstanceOf(Uint8Array);
      expect(publicKey.challenge.length).toBe(32);

      // crypto.getRandomValuesが呼ばれていることを確認
      expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
    });

    it('prfSalts.first / second を渡すと extensions.prf.eval に両方反映される', async () => {
      const firstSalt = new Uint8Array([10, 11, 12]);
      const secondSalt = new Uint8Array([20, 21, 22]);

      await createPasskey({}, { first: firstSalt, second: secondSalt });

      const callArgs = (navigator.credentials.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const prfEval = callArgs.publicKey.extensions.prf.eval;
      expect(prfEval.first).toBe(firstSalt);
      expect(prfEval.second).toBe(secondSalt);
    });

    it('create が prf.results を返した場合 prfFirst / prfSecond として返す', async () => {
      const firstBuf = new Uint8Array(32).fill(11).buffer;
      const secondBuf = new Uint8Array(32).fill(22).buffer;
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: vi.fn(async () => ({
            id: 'cred',
            rawId: new Uint8Array([9, 9, 9]).buffer,
            type: 'public-key',
            getClientExtensionResults: vi.fn(() => ({
              prf: { results: { first: firstBuf, second: secondBuf } },
            })),
          })),
        },
        configurable: true,
      });

      const result = await createPasskey(
        {},
        { first: new Uint8Array([1]), second: new Uint8Array([2]) }
      );

      expect(result.id).toEqual(new Uint8Array([9, 9, 9]));
      expect(result.prfFirst).toEqual(new Uint8Array(32).fill(11));
      expect(result.prfSecond).toEqual(new Uint8Array(32).fill(22));
    });

    it('create が PRF を返さない環境では prfFirst / prfSecond は undefined', async () => {
      // beforeEach で設定された mockCredential は getClientExtensionResults を持たない
      const result = await createPasskey();
      expect(result.prfFirst).toBeUndefined();
      expect(result.prfSecond).toBeUndefined();
    });
  });
});
