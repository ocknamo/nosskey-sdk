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

// NIP-44 / NIP-04 のエクスポート
// 低レベルプリミティブ (getConversationKey / getMessageKeys) は鍵再利用や
// nonce 再利用の足場になりうるため意図的に公開しない。
export { nip44Encrypt, nip44Decrypt } from './nip44.js';
export { nip04Encrypt, nip04Decrypt } from './nip04.js';

// PRFハンドラーのエクスポート
export { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';

// テスト用ユーティリティのエクスポート
export { registerDummyPasskey } from './test-utils.js';
