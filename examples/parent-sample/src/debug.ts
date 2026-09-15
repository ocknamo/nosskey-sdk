/**
 * 計測用オンページコンソール（console-daijin）の起動と、iframe URL への
 * デバッグフラグ伝播。
 *
 * iOS 実機は DevTools を開けないため、`?debug=1` を付けたときだけ親ページにも
 * ログパネルを出し、`NosskeyIframeError` のコードやタイムアウトを実機で読めるよう
 * にする。あわせて iframe URL にも `debug=1` を積み、親と iframe の両方のログを
 * 同時に採取できるようにする（スマホで 2 つの URL を手入力させない）。
 */

/**
 * 例外を「名前 + メッセージ」に潰す。オブジェクトをそのまま `console.error` へ
 * 渡すと、reason が署名済みイベントや鍵情報だった場合に全プロパティがパネルへ
 * 展開される。パネルのログは貼り付けて共有される前提なので、ここで絞る。
 */
function describeError(value: unknown): string {
  if (value instanceof DOMException) return `DOMException/${value.name}: ${value.message}`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  return `(${typeof value})`;
}

/** `debug` に与えられたとき有効と見なす値。値なし（`?debug`）も有効。 */
const TRUTHY = new Set(['', '1', 'true', 'on', 'yes']);

/** パネルを二重に出さないための番人。 */
let started = false;

function hasDebugParam(search: string): boolean {
  if (!search) return false;
  const value = new URLSearchParams(search).get('debug');
  return value !== null && TRUTHY.has(value.toLowerCase());
}

/** 親ページがデバッグモードで開かれているか。 */
export function isDebugEnabled(loc: Pick<Location, 'search'> = window.location): boolean {
  return hasDebugParam(loc.search);
}

/**
 * iframe URL の検索クエリへ `debug=1` を積む。`NosskeyIframeClient` は
 * `URL.searchParams.set()` で `embedded` / `theme` / `lang` を足すため既存の
 * クエリは保持され、ハッシュルート（`#/iframe`）も壊れない。
 * パースできない入力はそのまま返す。
 */
export function withIframeDebugFlag(
  url: string,
  enabled: boolean,
  base: string = window.location.href
): string {
  if (!enabled || !url) return url;
  try {
    const parsed = new URL(url, base);
    parsed.searchParams.set('debug', '1');
    return parsed.toString();
  } catch {
    return url;
  }
}

/** デバッグモードならオンページコンソールを起動する。多重呼び出しは無視する。 */
export async function startDebugConsole(): Promise<void> {
  if (!isDebugEnabled() || started) return;
  started = true;
  // 公開版 console-daijin 0.1.5 は未捕捉例外を拾わないため自前で橋渡しする。
  // 親側では `client.ready()` のタイムアウトなど、ハンドラ外で落ちる経路が該当する。
  window.addEventListener('error', (event) => {
    console.error('[parent-sample] uncaught', describeError(event.error ?? event.message));
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[parent-sample] unhandledrejection', describeError(event.reason));
  });
  console.warn(
    '[parent-sample] This panel captures the whole page console. Review the log before sharing it.'
  );
  try {
    const { createConsoleViewer } = await import('console-daijin');
    createConsoleViewer({ show: 'always', height: 200 });
  } catch (err) {
    console.warn('[parent-sample] failed to start console viewer', err);
  }
}
