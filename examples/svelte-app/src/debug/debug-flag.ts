/**
 * 計測用デバッグモードのフラグ解決。
 *
 * iOS 実機では DevTools を開けないため、`?debug=1` が付いているときだけ
 * オンページのコンソールビューア（console-daijin）と診断ログを有効化する。
 * 本番の通常アクセスでは一切読み込まれない（動的 import）。
 *
 * 受理する位置は 2 箇所:
 * - `location.search` — `NosskeyIframeClient.buildIframeUrl()` が `embedded` /
 *   `theme` / `lang` を積むのと同じ場所。既存クエリは保持されるので、親側で
 *   URL に `debug=1` を足しておけば iframe 側まで届く。
 * - ハッシュ内クエリ — 実機で `https://nosskey.app/#/iframe?debug=1` と直接
 *   打つ経路。ハッシュルーティングのため、こちらの書き方も自然に出てくる。
 */

/** `debug` に与えられたとき有効と見なす値。値なし（`?debug`）も有効。 */
const TRUTHY = new Set(['', '1', 'true', 'on', 'yes']);

type LocationLike = Pick<Location, 'search' | 'hash'>;

function resolveLocation(loc?: LocationLike): LocationLike | null {
  if (loc) return loc;
  return typeof window !== 'undefined' ? window.location : null;
}

/** ハッシュ（`#/iframe?debug=1`）からクエリ部分だけを取り出す。無ければ空文字。 */
function hashQuery(hash: string): string {
  const index = hash.indexOf('?');
  return index < 0 ? '' : hash.slice(index);
}

function hasDebugParam(search: string): boolean {
  if (!search) return false;
  const value = new URLSearchParams(search).get('debug');
  return value !== null && TRUTHY.has(value.toLowerCase());
}

/** 計測用コンソールを有効化すべきか。 */
export function isDebugConsoleEnabled(loc?: LocationLike): boolean {
  const resolved = resolveLocation(loc);
  if (!resolved) return false;
  return hasDebugParam(resolved.search) || hasDebugParam(hashQuery(resolved.hash));
}

/**
 * URL の検索クエリに `debug=1` を付けた文字列を返す。パースできない入力は
 * そのまま返す（計測用の付加機能でアプリを落とさない）。
 *
 * ハッシュではなく検索クエリに積むのは、`buildIframeUrl()` が
 * `url.searchParams.set()` で既存クエリを保持したまま `embedded` 等を足すため、
 * 親 → iframe の受け渡しで最も壊れにくいから。
 */
export function appendDebugFlag(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('debug', '1');
    return parsed.toString();
  } catch {
    return url;
  }
}
