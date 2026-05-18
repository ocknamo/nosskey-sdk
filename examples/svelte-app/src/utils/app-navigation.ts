/**
 * アプリ内のハッシュルートへの遷移ヘルパー。
 * iframe 埋め込み時は別タブで開く必要があるため、URL 組み立てを純粋関数に切り出す。
 */
import type { ScreenName } from '../store/app-state.js';

/**
 * アプリのハッシュルートへの絶対 URL を組み立てる。
 * クエリ文字列（`?embedded=1` など）は引き継がず、別タブでは通常の
 * スタンドアロン版アプリが開くようにする。
 */
export function buildScreenUrl(
  loc: Pick<Location, 'origin' | 'pathname'>,
  screen: ScreenName
): string {
  return `${loc.origin}${loc.pathname}#/${screen}`;
}
