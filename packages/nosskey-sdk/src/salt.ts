/**
 * PRF 評価入力に使う salt の定数と正規化ロジック。
 *
 * 以前は nosskey.ts と examples/svelte-app の accounts.ts に同一ロジックが
 * 二重定義されていた。登録簿（key-registry.ts）も同じ正規化を必要とするため、
 * ここへ一元化する。
 * @packageDocumentation
 */
import { hexToBytes } from './utils.js';

// 標準salt値（"nostr-pwk"のUTF-8バイトのhex）。実際のPRF評価入力と一致する。
export const STANDARD_SALT = '6e6f7374722d70776b';

// 旧誤値（"nostr-key"のhex）。過去に保存された NostrKeyInfo に残っている可能性があるが、
// 実際の導出は常に "nostr-pwk" で行われていたため、標準値へ正規化して扱う。
export const LEGACY_SALT = '6e6f7374722d6b6579';

// wrap モード用 salt 値（"nostr-pwk-wrap"のUTF-8バイトのhex）。PRF 直接モードと
// ドメイン分離するため、wrap モードでは異なる salt から KEK を導出する。
export const WRAP_SALT = '6e6f7374722d70776b2d77726170';

// PRF eval に渡す salt のバイト表現。createPasskey 時に first/second 両方を eval して
// 「直接モード用 PRF」と「wrap モード用 KEK」を 1 回の UV で同時取得するため。
export const STANDARD_SALT_BYTES = hexToBytes(STANDARD_SALT);
export const WRAP_SALT_BYTES = hexToBytes(WRAP_SALT);

/**
 * NostrKeyInfo.salt をPRF評価入力として使える値に正規化する。
 * 未設定・旧誤値は標準salt値に置き換える（既存鍵の保護）。
 * wrap モードの WRAP_SALT はそのまま維持される（`undefined` / 旧誤値のみ置換）。
 */
export function normalizeSalt(salt?: string): string {
  return !salt || salt === LEGACY_SALT ? STANDARD_SALT : salt;
}
