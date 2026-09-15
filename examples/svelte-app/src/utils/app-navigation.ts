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

/**
 * 画面遷移後に書き戻すハッシュを組み立てる。現在のハッシュに付いているクエリ
 * （`#/iframe?debug=1` の `?debug=1`）はそのまま引き継ぐ。
 *
 * 引き継がないと、`updateHash` が `#/{screen}` を書き戻した時点でクエリが消える。
 * 計測モードはリロードや BFCache 復帰のたびに URL から読み直されるため、消えると
 * 実機で「さっきまで出ていたパネルが出ない」という再現性の無さに化ける。
 */
export function buildHashForScreen(currentHash: string, screen: string): string {
  const queryAt = currentHash.indexOf('?');
  const query = queryAt < 0 ? '' : currentHash.slice(queryAt);
  return `#/${screen}${query}`;
}

/**
 * アプリのハッシュルートへの絶対 URL を組み立てる。
 * クエリ文字列（`?embedded=1` など）は引き継がず、別タブでは通常の
 * スタンドアロン版アプリが開くようにする（`debug` だけは明示指定で引き継ぐ）。
 */
export function buildScreenUrl(
  loc: Pick<Location, 'origin' | 'pathname'>,
  screen: ScreenName,
  options: ScreenUrlOptions = {}
): string {
  const url = `${loc.origin}${loc.pathname}#/${screen}`;
  return options.debug ? appendDebugFlag(url) : url;
}
