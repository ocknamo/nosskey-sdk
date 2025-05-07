import { bech32 } from 'bech32';
import { bytesToHex, hexToBytes } from '../../../../src/utils.js';

/**
 * 8ビットから5ビットへの変換（16進数からbech32準備）
 */
function convertBits(data: Uint8Array, fromBits: number, toBits: number, pad = true): Uint8Array {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;

  for (let p = 0; p < data.length; p++) {
    const value = data[p];
    acc = (acc << fromBits) | value;
    bits += fromBits;

    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }

  if (pad && bits > 0) {
    ret.push((acc << (toBits - bits)) & maxv);
  }

  return new Uint8Array(ret);
}

/**
 * 16進数形式の公開鍵をnpub形式に変換
 */
export function hexToNpub(hexPubkey: string): string {
  // 16進数文字列をバイト配列に変換
  const pubkeyBytes = hexToBytes(hexPubkey);

  // 8ビットから5ビットへ変換（bech32用）
  const words = convertBits(pubkeyBytes, 8, 5, true);

  // bech32エンコード
  return bech32.encode('npub', words);
}

/**
 * 16進数形式の秘密鍵をnsec形式に変換
 */
export function hexToNsec(hexPrivkey: string): string {
  // 16進数文字列をバイト配列に変換
  const privkeyBytes = hexToBytes(hexPrivkey);

  // 8ビットから5ビットへ変換（bech32用）
  const words = convertBits(privkeyBytes, 8, 5, true);

  // bech32エンコード
  return bech32.encode('nsec', words);
}

/**
 * npub形式を16進数形式に変換
 */
export function npubToHex(npub: string): string | null {
  try {
    const { prefix, words } = bech32.decode(npub);

    if (prefix !== 'npub') {
      throw new Error('Not an npub format');
    }

    // 5ビットから8ビットへ変換
    const bytes = convertBits(new Uint8Array(words), 5, 8, false);

    // バイト配列を16進数文字列に変換
    return bytesToHex(bytes);
  } catch (e) {
    console.error('npubからhexへの変換エラー:', e);
    return null;
  }
}

/**
 * nsec形式を16進数形式に変換
 */
export function nsecToHex(nsec: string): string | null {
  try {
    const { prefix, words } = bech32.decode(nsec);

    if (prefix !== 'nsec') {
      throw new Error('Not an nsec format');
    }

    // 5ビットから8ビットへ変換
    const bytes = convertBits(new Uint8Array(words), 5, 8, false);

    // バイト配列を16進数文字列に変換
    return bytesToHex(bytes);
  } catch (e) {
    console.error('nsecからhexへの変換エラー:', e);
    return null;
  }
}

/**
 * npub形式が有効かチェック
 */
export function isValidNpub(npub: string): boolean {
  try {
    const { prefix } = bech32.decode(npub);
    return prefix === 'npub';
  } catch (e) {
    return false;
  }
}

/**
 * nsec形式が有効かチェック
 */
export function isValidNsec(nsec: string): boolean {
  try {
    const { prefix } = bech32.decode(nsec);
    return prefix === 'nsec';
  } catch (e) {
    return false;
  }
}
