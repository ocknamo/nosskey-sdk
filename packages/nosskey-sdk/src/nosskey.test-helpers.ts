import { vi } from 'vitest';

/**
 * nosskey.*.spec.ts（機能ごとに分割した複数ファイル）が共有するテスト用モック。
 * 元は単一 spec の outer describe 内に直書きされていた WebAuthn / Web Crypto の
 * セットアップを、ファイル分割に伴い共通化したもの。挙動は分割前と同一。
 */

export const mockPrfResultValue = 42;
export const mockCredentialId = new Uint8Array(16).fill(1);

export interface WebAuthnMockContext {
  /** beforeEach で取得した元実装へ globalThis.crypto / navigator.credentials を戻す。 */
  restore(): void;
}

/**
 * WebAuthn（navigator.credentials）と Web Crypto（globalThis.crypto）のモックを
 * インストールし、復元用ハンドルを返す。各 spec の beforeEach で呼び、afterEach で
 * 返り値の restore() を呼ぶこと。
 */
export function installWebAuthnMocks(): WebAuthnMockContext {
  const originalCrypto = globalThis.crypto;
  const originalCredentials = globalThis.navigator.credentials;

  // PRF出力を含むモックの応答。getClientExtensionResults() は呼び出しごとに
  // 新しい ArrayBuffer を返す。NosskeyManager は秘密鍵をエフェメラルに使い
  // 終わったあと .fill(0) で消去するので、共有バッファを使うとそれが次の
  // 呼び出しに伝播する（ゼロ鍵 → ECDH エラー）。実機ブラウザでは PRF も
  // 毎回フレッシュなので、フレッシュ生成の方が現実に近い挙動でもある。
  const mockCredential = {
    id: 'mock-credential-id',
    rawId: mockCredentialId.buffer,
    type: 'public-key',
    getClientExtensionResults: vi.fn(() => ({
      prf: {
        results: {
          first: new Uint8Array(32).fill(mockPrfResultValue).buffer,
        },
      },
    })),
  };

  // Navigator Credentialsのモック
  Object.defineProperty(globalThis.navigator, 'credentials', {
    value: {
      create: vi.fn(async () => mockCredential),
      get: vi.fn(async () => mockCredential),
    },
    configurable: true,
  });

  // Web Crypto APIのモック
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      getRandomValues: vi.fn((arr) => {
        arr.fill(99);
        return arr;
      }),
      subtle: {
        importKey: vi.fn(async () => 'mock-key'),
        deriveKey: vi.fn(async () => 'mock-derived-key'),
        encrypt: vi.fn(async () => {
          // 32バイトの暗号文 + 16バイトのタグを返す
          return new Uint8Array([...new Uint8Array(32).fill(77), ...new Uint8Array(16).fill(88)])
            .buffer;
        }),
        decrypt: vi.fn(async () => {
          // 復号された32バイトの秘密鍵を返す
          return new Uint8Array(32).fill(66).buffer;
        }),
      },
    },
    configurable: true,
  });

  return {
    restore() {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
      Object.defineProperty(globalThis.navigator, 'credentials', {
        value: originalCredentials,
        configurable: true,
      });
    },
  };
}
