import { vi } from 'vitest';

/**
 * prf-handler.*.spec.ts（機能ごとに分割した複数ファイル）が共有する
 * WebAuthn / Web Crypto モックのセットアップ。元は単一 spec の outer describe
 * 内に直書きされていたものをファイル分割に伴い共通化した。挙動は分割前と同一。
 */
export interface PrfMockContext {
  /** beforeEach で取得した元実装へ crypto / credentials / location を戻す。 */
  restore(): void;
}

/**
 * Web Crypto（getRandomValues）モックをインストールし、復元用ハンドルを返す。
 * navigator.credentials / location は各テスト内で差し替えられるため、復元時に
 * まとめて元へ戻す。各 spec の beforeEach で呼び、afterEach で restore() を呼ぶこと。
 */
export function installPrfMocks(): PrfMockContext {
  const originalCrypto = globalThis.crypto;
  const originalCredentials = globalThis.navigator.credentials;
  const originalLocation = globalThis.location;

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
      Object.defineProperty(globalThis, 'location', {
        value: originalLocation,
        configurable: true,
      });
    },
  };
}
