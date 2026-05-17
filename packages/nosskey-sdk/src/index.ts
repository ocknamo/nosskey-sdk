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

// NIP-44 低レベル関数のエクスポート。
// nip44Encrypt/Decrypt は ephemeral 秘密鍵での暗号化 (NIP-17 gift-wrap など、
// 例: examples/parent-sample/src/nip17.ts) に必要。登録鍵専用の
// NosskeyManager.nip44Encrypt メソッドでは ephemeral 鍵を扱えず代替できないため、
// バレルからの公開を維持する。
// nip04 の低レベル関数は外部利用が無く、NIP-04 機能は NosskeyManager の
// nip04Encrypt/Decrypt メソッドで提供されるため公開しない。
// getConversationKey / getMessageKeys 等のプリミティブは鍵/nonce 再利用の
// 足場になりうるため意図的に非公開。
export { nip44Encrypt, nip44Decrypt } from './nip44.js';

// PRFハンドラーのエクスポート
export { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';

// テスト用ユーティリティのエクスポート
export { registerDummyPasskey } from './test-utils.js';
