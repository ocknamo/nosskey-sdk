import type { NostrKeyInfo } from 'nosskey-sdk';

/**
 * NostrKeyInfo をエクスポート（バックアップ／インポート往復）用の JSON 文字列へ
 * 直列化する純粋関数。
 *
 * インポート側（`ImportKeyInfo.svelte`）は `JSON.parse` → `isNostrKeyInfo`
 * 検証 → `loginWith` の経路で取り込むため、ここでは KeyInfo オブジェクト
 * そのものを直列化する必要がある。以前は誤ってエクスポート関数自身を
 * 直列化しており往復が成立しなかった（回帰防止のため本関数として切り出し）。
 */
export function serializeKeyInfoForExport(keyInfo: NostrKeyInfo): string {
  return JSON.stringify(keyInfo, null, 2);
}
