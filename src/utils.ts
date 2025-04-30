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
