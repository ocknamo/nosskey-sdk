/**
 * バイト変換ユーティリティ関数
 * @packageDocumentation
 */

/**
 * バイト配列を16進数文字列に変換する
 * @param bytes 変換するバイト配列
 * @returns 16進数文字列
 */
export function bytesToHex(bytes: Uint8Array): string {
  const key = '0123456789abcdef';
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const firstNibble = bytes[i] >> 4;
    const secondNibble = bytes[i] & 15;
    hex += key[firstNibble] + key[secondNibble];
  }
  return hex;
}

/**
 * バイト配列を base64 文字列に変換する。ブラウザの `btoa` を優先し、
 * Node 環境では `Buffer` にフォールバックする。
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  return Buffer.from(bytes).toString('base64');
}

/**
 * base64 文字列をバイト配列に変換する。`atob` がない環境では `Buffer`
 * にフォールバックする。
 */
export function base64ToBytes(str: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(str, 'base64'));
}

/**
 * 16進数文字列をバイト配列に変換する
 * @param hex 変換する16進数文字列
 * @returns バイト配列
 */
export function hexToBytes(hex: string): Uint8Array {
  const key = '0123456789abcdef';
  const bytes = [];
  let currentByte = 0;
  let highNibble = true; // 上位4ビットから処理開始

  for (let i = 0; i < hex.length; i++) {
    const charValue = key.indexOf(hex[i].toLowerCase());
    if (charValue === -1) continue; // 16進数以外の文字はスキップ

    if (highNibble) {
      // 上位4ビット
      currentByte = charValue << 4;
      highNibble = false;
    } else {
      // 下位4ビット
      currentByte += charValue;
      bytes.push(currentByte);
      highNibble = true;
    }
  }

  return new Uint8Array(bytes);
}
