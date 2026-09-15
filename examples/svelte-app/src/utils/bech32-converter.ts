import { bech32 } from 'bech32';
import { bytesToHex, hexToBytes } from 'nosskey-sdk';

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
 * 64文字hexの公開鍵を「先頭head文字…末尾tail文字」の短縮npub表記にする。
 * npub変換に失敗した場合（不正なpubkey等）はhexの短縮にフォールバックする。
 * UI 各所（アカウント一覧 / プロフィール表示 / 同意ダイアログ）で共用する。
 */
export function shortenNpub(hexPubkey: string, head = 12, tail = 8): string {
  try {
    const npub = hexToNpub(hexPubkey);
    if (npub.length <= head + tail + 1) return npub;
    return `${npub.slice(0, head)}…${npub.slice(-tail)}`;
  } catch {
    return hexPubkey.length > 16 ? `${hexPubkey.slice(0, 8)}…${hexPubkey.slice(-8)}` : hexPubkey;
  }
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
 * bech32 のデコード失敗を、入力文字列を含まない分類名に落とす。
 *
 * `bech32@2` は失敗メッセージへ**入力文字列そのもの**を連結する
 * （`Invalid checksum for <入力>` / `<入力> too short` 等）。そのまま
 * `console.error` へ渡すと、打ち間違えた nsec が console に流れ、計測モード
 * （`?debug=1`）のパネル経由で外部へ持ち出されうる。一方で `e.name` は常に
 * `'Error'` で切り分けの役に立たないため、既知の失敗理由だけを既定の語に
 * 対応付けて返す。未知のメッセージは入力が混ざっている可能性があるので出さない。
 */
function describeBech32Error(e: unknown): string {
  if (!(e instanceof Error)) return 'unknown error';
  const message = e.message;
  const known = [
    'Invalid checksum',
    'Mixed-case string',
    'No separator character',
    'Missing prefix',
    'Exceeds length limit',
    'Invalid prefix',
    'Unknown character',
    'Data too short',
  ];
  const matched = known.find((reason) => message.startsWith(reason));
  if (matched) return matched;
  // `<入力> too short` のように入力が先頭に来る形式は分類名だけを返す。
  if (message.endsWith('too short')) return 'too short';
  return 'unrecognized bech32 error';
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
    // nsec 側と同じ理由で例外オブジェクトを出さない（bech32 は失敗メッセージへ
    // 入力文字列を埋め込む）。npub は公開情報だが、扱いを揃えて事故を防ぐ。
    console.error('npubからhexへの変換エラー:', describeBech32Error(e));
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
    // 例外オブジェクトをそのまま出さない。bech32 の `decode()` は失敗メッセージへ
    // **入力文字列そのもの**を埋め込む（`Invalid checksum for <入力>` 等）ため、
    // 打ち間違えた nsec が console に流れる。分類名だけに落とす。
    console.error('nsecからhexへの変換エラー:', describeBech32Error(e));
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
