/**
 * アプリ内のハッシュルートへの遷移ヘルパー。
 * iframe 埋め込み時は別タブで開く必要があるため、URL 組み立てを純粋関数に切り出す。
 */
import { appendDebugFlag } from '../debug/debug-flag.js';
import type { ScreenName } from '../store/app-state.js';

export interface ScreenUrlOptions {
  /**
   * 計測用デバッグモード（`?debug=1`）を遷移先へ引き継ぐ。iframe から別タブの
   * セットアップ画面へ飛ぶ調査で、タブごとに URL を打ち直さずに済ませるため。
   */
  debug?: boolean;
}

/**
 * アプリのハッシュルートへの絶対 URL を組み立てる。
 * クエリ文字列（`?embedded=1` など）は引き継がず、別タブでは通常の
 * スタンドアロン版アプリが開くようにする（`debug` だけは明示指定で引き継ぐ）。
 */
/**
 * `location.hash` から画面名を取り出す。先頭の `#` / `/` と、ハッシュ内クエリ
 * （`#/iframe?debug=1`）を落とす。
 *
 * クエリを落とすのが要点。落とさないと `iframe?debug=1` という文字列が画面名として
 * 評価され、どの画面にも一致せず既定の `account` へ黙ってフォールバックする。
 * ハッシュルーティングのアプリに `#/route?param=x` を渡すのは自然な書き方なので、
 * ここで吸収する。
 */
export function screenNameFromHash(hash: string): string {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const withoutQuery = withoutHash.split('?')[0];
  return withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery;
}

export function buildScreenUrl(
  loc: Pick<Location, 'origin' | 'pathname'>,
  screen: ScreenName,
  options: ScreenUrlOptions = {}
): string {
  const url = `${loc.origin}${loc.pathname}#/${screen}`;
  return options.debug ? appendDebugFlag(url) : url;
}
