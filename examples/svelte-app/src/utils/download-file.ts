/**
 * テキスト内容をファイルとしてダウンロードさせる DOM ヘルパー。
 *
 * 鍵情報のバックアップ（`ExportKeyInfoComponent` / `WrapKeyBackupPrompt`）で
 * 同一の Blob → object URL → `<a>.click()` → revoke の手順を共有するため切り出した。
 */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'application/json'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
