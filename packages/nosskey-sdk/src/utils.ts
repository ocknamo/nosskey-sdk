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

/** 16進数のみ（大文字小文字許容）にマッチする。空文字列も許容する。 */
const HEX_ONLY = /^[0-9a-f]*$/i;

/**
 * 16進数文字列を**厳格に**バイト配列へ変換する。
 *
 * {@link hexToBytes} は不正文字を黙ってスキップし長さも検証しないため、
 * 改ざんされ得る保存値（`credentialId` / `salt` / 復号済み nsec など）の
 * パースには使わないこと。本関数は以下のいずれかに違反する入力で `Error`
 * を投げる:
 * - 16進数以外の文字を含む
 * - 長さが奇数（バイト境界に揃っていない）
 * - `expectedBytes` 指定時、結果のバイト長が一致しない
 *
 * エラーメッセージには長さ情報のみを含め、入力値（秘匿データになり得る）は
 * 載せない。
 *
 * @param hex 16進数文字列（`0x` プレフィックス不可）
 * @param expectedBytes 期待するバイト長。省略時は長さを強制しない
 * @returns デコードしたバイト配列
 * @throws 上記いずれかに違反した場合
 */
export function hexToBytesStrict(hex: string, expectedBytes?: number): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`hexToBytesStrict: odd-length hex string (length ${hex.length}).`);
  }
  if (!HEX_ONLY.test(hex)) {
    throw new Error('hexToBytesStrict: input contains non-hex characters.');
  }
  const byteLength = hex.length / 2;
  if (expectedBytes !== undefined && byteLength !== expectedBytes) {
    throw new Error(`hexToBytesStrict: expected ${expectedBytes} byte(s) but got ${byteLength}.`);
  }
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
