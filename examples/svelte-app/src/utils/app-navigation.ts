/**
 * アプリ内のハッシュルートへの遷移ヘルパー。
 * iframe 埋め込み時は別タブで開く必要があるため、URL 組み立てを純粋関数に切り出す。
 */
import type { ScreenName } from '../store/app-state.js';

/**
 * `location.hash` から画面名を取り出す。先頭の `#` / `/` と、ハッシュ内クエリ
 * （`#/key?tab=2`）を落とす。
 *
 * クエリを落とすのが要点。落とさないと `key?tab=2` という文字列が画面名として
 * 評価され、どの画面にも一致せず既定の `account` へ黙ってフォールバックする。
 * ハッシュルーティングのアプリに `#/route?param=x` を渡すのは自然な書き方なので、
 * ここで吸収する。
 */
export function screenNameFromHash(hash: string): string {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const withoutQuery = withoutHash.split('?')[0];
  return withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery;
}

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
