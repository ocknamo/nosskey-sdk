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

// NIP-44 / NIP-04 のエクスポート
export { nip44Encrypt, nip44Decrypt, getConversationKey, getMessageKeys } from './nip44.js';
export { nip04Encrypt, nip04Decrypt } from './nip04.js';

// PRFハンドラーのエクスポート
export { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';

// テスト用ユーティリティのエクスポート
export { registerDummyPasskey } from './test-utils.js';
