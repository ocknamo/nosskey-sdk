/**
 * PRF handler tests
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';
import type { PasskeyCreationOptions } from './types.js';

describe('prf-handler', () => {
  let originalCrypto: typeof globalThis.crypto;
  let originalCredentials: typeof globalThis.navigator.credentials;
  let originalLocation: typeof globalThis.location;

  // WebAuthn APIのモック
  beforeEach(() => {
    originalCrypto = globalThis.crypto;
    originalCredentials = globalThis.navigator.credentials;
    originalLocation = globalThis.location;

    // Web Crypto APIのモック
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: vi.fn((arr) => {
          // テスト用の固定値を設定
          for (let i = 0; i < arr.length; i++) {
            arr[i] = (i + 1) % 256;
          }
          return arr;
        }),
      },
      configurable: true,
    });
  });

  // クリーンアップ
  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: originalCredentials,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'location', {
      value: originalLocation,
      configurable: true,
    });
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

      const credentialId = await createPasskey();

      expect(credentialId).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
      expect(navigator.credentials.create).toHaveBeenCalled();

      const callArgs = (navigator.credentials.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const publicKey = callArgs.publicKey;

      expect(publicKey.rp.name).toBe('example.com');
      expect(publicKey.user.name).toBe('user@example.com');
      expect(publicKey.user.displayName).toBe('Nosskey user');
      expect(publicKey.extensions).toEqual({ prf: {} });
    });

    it('Node環境（location未定義）でも動作する', async () => {
      // locationを未定義にする
      Object.defineProperty(globalThis, 'location', {
        value: undefined,
        configurable: true,
      });

      const credentialId = await createPasskey();

      expect(credentialId).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

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
  });

  describe('getPrfSecret', () => {
    const mockPrfResult = new Uint8Array(32).fill(99).buffer;
    const mockCredentialId = new Uint8Array([10, 20, 30, 40]);
    let mockCredential: Partial<PublicKeyCredential> & {
      rawId: ArrayBuffer;
      getClientExtensionResults: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockCredential = {
        rawId: mockCredentialId.buffer,
        getClientExtensionResults: vi.fn(() => ({
          prf: {
            results: {
              first: mockPrfResult,
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
    });

    it('credentialIdを指定してPRF秘密を取得できる', async () => {
      const result = await getPrfSecret(mockCredentialId);

      expect(result.secret).toEqual(new Uint8Array(32).fill(99));
      expect(result.id).toEqual(mockCredentialId);

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.publicKey.allowCredentials).toEqual([
        { type: 'public-key', id: mockCredentialId },
      ]);
    });

    it('credentialIdを省略してPRF秘密を取得できる', async () => {
      const result = await getPrfSecret();

      expect(result.secret).toEqual(new Uint8Array(32).fill(99));
      expect(result.id).toEqual(mockCredentialId);

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.publicKey.allowCredentials).toEqual([]);
    });

    it('正しいPRF評価パラメータで呼び出される', async () => {
      await getPrfSecret(mockCredentialId);

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const publicKey = callArgs.publicKey;

      expect(publicKey.challenge).toBeInstanceOf(Uint8Array);
      expect(publicKey.challenge.length).toBe(32);
      expect(publicKey.userVerification).toBe('required');
      expect(publicKey.extensions.prf.eval.first).toEqual(new TextEncoder().encode('nostr-pwk'));
    });

    it('認証に失敗した場合（responseがnull）はエラーを投げる', async () => {
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => null),
        },
        configurable: true,
      });

      await expect(getPrfSecret(mockCredentialId)).rejects.toThrow('Authentication failed');
    });

    it('PRF秘密が利用できない場合はエラーを投げる', async () => {
      const mockCredentialNoPrf = {
        rawId: mockCredentialId.buffer,
        getClientExtensionResults: vi.fn(() => ({
          prf: {
            results: {}, // firstがない
          },
        })),
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockCredentialNoPrf),
        },
        configurable: true,
      });

      await expect(getPrfSecret(mockCredentialId)).rejects.toThrow('PRF secret not available');
    });

    it('PRF拡張結果がない場合はエラーを投げる', async () => {
      const mockCredentialNoExt = {
        rawId: mockCredentialId.buffer,
        getClientExtensionResults: vi.fn(() => ({})), // prfがない
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockCredentialNoExt),
        },
        configurable: true,
      });

      await expect(getPrfSecret(mockCredentialId)).rejects.toThrow('PRF secret not available');
    });

    it('getClientExtensionResults自体がない場合はエラーを投げる', async () => {
      const mockInvalidCredential = {
        rawId: mockCredentialId.buffer,
        // getClientExtensionResultsがない
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockInvalidCredential),
        },
        configurable: true,
      });

      await expect(getPrfSecret(mockCredentialId)).rejects.toThrow();
    });

    it('responseからcredentialIdを正しく取得する', async () => {
      const differentCredentialId = new Uint8Array([50, 60, 70, 80]);
      const mockResponse = {
        rawId: differentCredentialId.buffer,
        getClientExtensionResults: vi.fn(() => ({
          prf: { results: { first: mockPrfResult } },
        })),
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockResponse),
        },
        configurable: true,
      });

      const result = await getPrfSecret(mockCredentialId);

      // レスポンスのcredentialIdが返されることを確認
      expect(result.id).toEqual(differentCredentialId);
    });

    it('rpIdオプションを設定できる', async () => {
      const options = {
        rpId: 'example.com',
      };

      await getPrfSecret(mockCredentialId, options);

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.publicKey.rpId).toBe('example.com');
    });

    it('timeoutオプションを設定できる', async () => {
      const options = {
        timeout: 60000,
      };

      await getPrfSecret(mockCredentialId, options);

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.publicKey.timeout).toBe(60000);
    });

    it('userVerificationオプションを設定できる', async () => {
      const options = {
        userVerification: 'preferred' as UserVerificationRequirement,
      };

      await getPrfSecret(mockCredentialId, options);

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.publicKey.userVerification).toBe('preferred');
    });

    it('複数のオプションを同時に設定できる', async () => {
      const options = {
        rpId: 'myapp.com',
        timeout: 30000,
        userVerification: 'discouraged' as UserVerificationRequirement,
      };

      await getPrfSecret(mockCredentialId, options);

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.publicKey.rpId).toBe('myapp.com');
      expect(callArgs.publicKey.timeout).toBe(30000);
      expect(callArgs.publicKey.userVerification).toBe('discouraged');
    });

    it('オプション未指定時はデフォルト値が使用される', async () => {
      await getPrfSecret(mockCredentialId);

      const callArgs = (navigator.credentials.get as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.publicKey.rpId).toBeUndefined();
      expect(callArgs.publicKey.timeout).toBeUndefined();
      expect(callArgs.publicKey.userVerification).toBe('required');
    });
  });

  describe('定数と内部処理', () => {
    it('PRF評価入力値が正しい', () => {
      const expected = new TextEncoder().encode('nostr-pwk');

      // isPrfSupportedを呼び出して内部の定数を確認
      const mockCredential = {
        getClientExtensionResults: vi.fn(() => ({
          prf: { results: { first: new ArrayBuffer(32) } },
        })),
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async (options) => {
            const prfInput = options.publicKey.extensions.prf.eval.first;
            expect(prfInput).toEqual(expected);
            return mockCredential;
          }),
        },
        configurable: true,
      });

      return isPrfSupported();
    });

    it('型アサーションが正しく動作する', async () => {
      // WebAuthn APIレスポンスの型アサーションをテスト
      const mockSecret = new Uint8Array([1, 2, 3, 4]).buffer;
      const mockId = new Uint8Array([5, 6, 7, 8]);

      const mockResponse = {
        rawId: mockId.buffer,
        getClientExtensionResults: () => ({
          prf: {
            results: {
              first: mockSecret,
            },
          },
        }),
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockResponse),
        },
        configurable: true,
      });

      const result = await getPrfSecret();

      expect(result.secret).toEqual(new Uint8Array(mockSecret));
      expect(result.id).toEqual(mockId);
    });
  });

  describe('エラーハンドリングの詳細', () => {
    it('navigator.credentials.getでの例外を適切に処理する', async () => {
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => {
            throw new DOMException('Operation cancelled', 'AbortError');
          }),
        },
        configurable: true,
      });

      await expect(getPrfSecret()).rejects.toThrow('Operation cancelled');
    });

    it('navigator.credentials.createでの例外を適切に処理する', async () => {
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          create: vi.fn(async () => {
            throw new DOMException('User cancelled', 'NotAllowedError');
          }),
        },
        configurable: true,
      });

      await expect(createPasskey()).rejects.toThrow('User cancelled');
    });

    it('getClientExtensionResultsでの例外を適切に処理する', async () => {
      const mockResponse = {
        rawId: new Uint8Array([1, 2, 3]).buffer,
        getClientExtensionResults: vi.fn(() => {
          throw new Error('Extension error');
        }),
      };

      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: {
          get: vi.fn(async () => mockResponse),
        },
        configurable: true,
      });

      await expect(getPrfSecret()).rejects.toThrow('Extension error');
    });
  });
});
