/**
 * Nosskey SDK - Passkey-Derived Nostr Identity
 * @packageDocumentation
 */

// 型定義のエクスポート
export * from './types.js';

// クラスとユーティリティのエクスポート
export { NosskeyManager } from './nosskey.js';

// ユーティリティのエクスポート
export { bytesToHex, hexToBytes } from './utils.js';

// 暗号化ユーティリティのエクスポート
export { aesGcmDecrypt, aesGcmEncrypt, deriveAesGcmKey } from './crypto-utils.js';

// PRFハンドラーのエクスポート
export { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';

// テスト用ユーティリティのエクスポート
export { registerDummyPasskey } from './test-utils.js';
