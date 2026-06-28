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

/**
 * バックアップファイルのダウンロード名を組み立てる純粋関数。
 *
 * 複数アカウント・複数回のエクスポートでファイル名が衝突しないよう、
 * ユーザー名（空白除去・ファイル名に使えない文字も除去）と日付（YYYY-MM-DD）を
 * 付与する。ユーザー名が無い場合は日付のみで構成する。
 *
 * 例: `nosskey-key-info-backup-alice-2026-06-28.json`
 *     `nosskey-key-info-backup-2026-06-28.json`（username 無し）
 */
export function buildKeyInfoBackupFilename(keyInfo: NostrKeyInfo, date: Date = new Date()): string {
  const base = 'nosskey-key-info-backup';

  // 空白を除去し、パス区切り・予約文字などファイル名を壊す文字も落とす。
  const safeUsername = (keyInfo.username ?? '').replace(/\s+/g, '').replace(/[<>:"/\\|?*]/g, '');

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const datePart = `${yyyy}-${mm}-${dd}`;

  const parts = [base, safeUsername, datePart].filter((p) => p.length > 0);
  return `${parts.join('-')}.json`;
}
