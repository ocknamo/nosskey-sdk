/**
 * Cryptographic utilities for Nosskey
 * @packageDocumentation
 */

/* 定数 */
const INFO_BYTES = new TextEncoder().encode('nostr-pwk');
const AES_LENGTH = 256; // bits

/**
 * PRF秘密からAES-GCM鍵を導出
 * @param secret PRF秘密
 * @param salt ソルト
 * @returns AES-GCM鍵
 */
export async function deriveAesGcmKey(secret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: INFO_BYTES },
    keyMaterial,
    { name: 'AES-GCM', length: AES_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * AES-GCM暗号化
 * @param key 暗号化鍵
 * @param iv 初期化ベクトル
 * @param plaintext 平文
 * @returns 暗号文と認証タグ
 */
export async function aesGcmEncrypt(key: CryptoKey, iv: Uint8Array, plaintext: Uint8Array) {
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  // 認証タグ(16バイト)と暗号文を分離
  const bytes = new Uint8Array(buf);
  return {
    ciphertext: bytes.slice(0, -16),
    tag: bytes.slice(-16),
  };
}

/**
 * AES-GCM復号
 * @param key 復号鍵
 * @param iv 初期化ベクトル
 * @param ct 暗号文
 * @param tag 認証タグ
 * @returns 復号された平文
 */
export async function aesGcmDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ct: Uint8Array,
  tag: Uint8Array
): Promise<Uint8Array> {
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    new Uint8Array([...ct, ...tag])
  );
  return new Uint8Array(buf);
}
