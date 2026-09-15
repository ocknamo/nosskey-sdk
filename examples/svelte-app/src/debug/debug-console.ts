/**
 * 計測用オンページコンソールの起動と、調査ログのヘルパー。
 *
 * iOS 実機は DevTools を開けないため、`?debug=1` のときだけ
 * [console-daijin](https://github.com/ocknamo/console-daijin) のパネルを
 * ページ内に出す。
 *
 * 未捕捉例外と unhandled rejection は**自前で** console へ橋渡しする。公開版
 * console-daijin 0.1.5 はこれらを拾わないうえ、この調査で最も見たい経路が
 * `IframeHostScreen.detectInitialState()` の `NotAllowedError` 以外での reject
 * ＝ unhandled rejection（状態カードが一切出ず画面が無言で固まる）だからである。
 * ライブラリ側が将来これを拾うようになると 1 事象が 2 行出るが、取りこぼすより
 * 重複する方が調査上は安全なので許容する。
 *
 * 通常アクセスでは動的 import ごと評価されないため、本番バンドルの実行経路に
 * 計測コードは乗らない。
 */
import { peekNosskeyManager } from '../services/nosskey-manager.service.js';
import { isDebugConsoleEnabled } from './debug-flag.js';
import {
  buildStorageDiagnostics,
  formatStorageDiagnostics,
  type StorageDiagnostics,
} from './storage-diagnostics.js';

/** `isDebugConsoleEnabled()` の結果をキャッシュする（location は変わらない）。 */
let enabledCache: boolean | null = null;

/** パネルを二重に出さないための番人。 */
let started = false;

/**
 * console-daijin の dispose 関数。公開版 0.1.5 は何も返さない（型も `void`）ため、
 * 返ってきたときだけ保持する。
 */
let dispose: (() => void) | null = null;

/** 未捕捉例外ブリッジの解除関数。 */
let removeUncaughtBridge: (() => void) | null = null;

function enabled(): boolean {
  if (enabledCache === null) enabledCache = isDebugConsoleEnabled();
  return enabledCache;
}

/** テスト用。モジュールキャッシュを初期化する。 */
export function resetDebugConsoleForTest(): void {
  enabledCache = null;
  removeUncaughtBridge?.();
  removeUncaughtBridge = null;
  dispose?.();
  dispose = null;
  started = false;
}

/**
 * 調査用ログ。デバッグモードでないときは完全な no-op なので、呼び出し側に
 * 条件分岐を撒かずに済む。
 */
export function debugLog(...args: unknown[]): void {
  if (!enabled()) return;
  console.info('[nosskey:debug]', ...args);
}

/** 例外を「名前 + メッセージ」に潰す。スタックはパネルが別途保持する。 */
export function describeError(err: unknown): string {
  if (err instanceof DOMException) return `DOMException/${err.name}: ${err.message}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/**
 * デバッグモードならオンページコンソールを起動する。多重呼び出しは無視する
 * （ルート遷移や HMR で 2 枚出さない）。
 */
export async function startDebugConsole(options: { height?: number } = {}): Promise<void> {
  if (!enabled() || started) return;
  started = true;
  removeUncaughtBridge = installUncaughtBridge();
  // iframe の中では親が用意したカード（360x440 程度）が全画面なので、パネルを
  // 低くしないと「アクセスを許可」ボタンを覆って調査自体が進まなくなる。
  const height = options.height ?? (window.top !== window.self ? 120 : 200);
  try {
    const { createConsoleViewer } = await import('console-daijin');
    // 0.1.5 は戻り値なし、リポジトリ main は dispose 関数を返す。両対応にする。
    const result: unknown = createConsoleViewer({ show: 'always', height });
    dispose = typeof result === 'function' ? (result as () => void) : null;
  } catch (err) {
    // 計測の失敗でアプリを止めない。ブリッジは張ったままなので、パネルが出なくても
    // ブラウザ標準の console には未捕捉例外が残る。
    console.warn('[nosskey:debug] failed to start console viewer', err);
  }
}

/**
 * 未捕捉例外 / unhandled rejection を `console.error` へ流す。パネルは console
 * しか見ていないため、この橋渡しが無いと「無言で固まる」経路が記録に残らない。
 */
function installUncaughtBridge(): () => void {
  const onError = (event: ErrorEvent): void => {
    // リソース読み込み失敗は ErrorEvent だが error も message も持たないことがある。
    const detail = event.error ? describeError(event.error) : event.message || '(no message)';
    console.error('[nosskey:debug] uncaught', detail, `${event.filename}:${event.lineno}`);
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    console.error('[nosskey:debug] unhandledrejection', describeError(event.reason));
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

/** 現在のストレージ状態のスナップショットを取る。値は含めない。 */
export function collectStorageDiagnostics(): StorageDiagnostics {
  let localStorageRef: Storage | null = null;
  let localStorageError: string | undefined;
  try {
    localStorageRef = window.localStorage;
  } catch (err) {
    localStorageError = describeError(err);
  }
  let cookie = '';
  try {
    cookie = document.cookie;
  } catch {
    // Safari は cookie が完全にブロックされた文脈で throw することがある。
    cookie = '';
  }
  const manager = peekNosskeyManager();
  return buildStorageDiagnostics({
    location: window.location,
    userAgent: navigator.userAgent,
    framed: window.top !== window.self,
    secureContext: window.isSecureContext,
    hasStorageAccessApi: typeof document.requestStorageAccess === 'function',
    localStorage: localStorageRef,
    ...(localStorageError && { localStorageError }),
    cookie,
    manager: {
      initialized: manager !== null,
      hasKeyInfo: manager?.hasKeyInfo() ?? false,
      storage: manager?.getStorageOptions().storage ?? null,
    },
  });
}

/** スナップショットをパネルへ出す。デバッグモードでなければ何もしない。 */
export function logStorageDiagnostics(label: string): void {
  if (!enabled()) return;
  console.info(
    `[nosskey:debug] ${label}\n${formatStorageDiagnostics(collectStorageDiagnostics())}`
  );
}
