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
 * 本モジュール自体は静的 import されるため本番バンドルに含まれる（フラグ無効時は
 * 各関数が即 return する）。動的 import なのは console-daijin 本体だけで、そちらは
 * 別チャンクに分離され、`?debug=1` が無ければ取得もされない。
 */
import { peekNosskeyManager } from '../services/nosskey-manager.service.js';
import { isDebugConsoleEnabled } from './debug-flag.js';
import {
  buildStorageDiagnostics,
  formatStorageDiagnostics,
  type StorageDiagnostics,
} from './storage-diagnostics.js';

/**
 * `isDebugConsoleEnabled()` の結果をキャッシュする。アプリはマウント直後に
 * `location.hash` を書き戻すため、起動時に一度だけ解決して以後は使い回す。
 */
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

/** 計測モードか（起動時に 1 回だけ解決してキャッシュする）。 */
function enabled(): boolean {
  if (enabledCache === null) enabledCache = isDebugConsoleEnabled();
  return enabledCache;
}

/**
 * 計測モードか。**`isDebugConsoleEnabled()` を直接呼ばず必ずこちらを使うこと。**
 *
 * `main.ts` が `mount()` より前に解決した値を返す。アプリはマウント直後に
 * `updateHash` で `location.hash` を書き戻すため、画面コンポーネントの中から
 * location を読み直すと、その時点のハッシュ次第でフラグを取りこぼす
 * （`#/iframe?debug=1` で実際に起きていた）。解決を起動時 1 回に固定して、
 * 以後の URL 書き換えから切り離す。
 */
export function isDebugEnabled(): boolean {
  return enabled();
}

/** テスト用。モジュールキャッシュを初期化する。 */
export function resetDebugConsoleForTest(): void {
  document.documentElement.style.removeProperty('--nosskey-debug-panel-height');
  document.body.classList.remove('nosskey-debug-console');
  enabledCache = null;
  removeUncaughtBridge?.();
  removeUncaughtBridge = null;
  dispose?.();
  dispose = null;
  started = false;
}

/**
 * 調査用ログ。デバッグモードでないときは何も出力しない。
 *
 * ただし**引数は呼び出し前に必ず評価される**。副作用のある式（`hasKeyInfo()` の
 * ような SDK の状態照会 API など）を引数に置くと、計測が無効でもその副作用だけが
 * 走る。渡してよいのは値の読み出しだけに留めること。
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
    markPanelMounted(height);
    warnAboutSharing();
  } catch (err) {
    // 計測の失敗でアプリを止めない。ブリッジは張ったままなので、パネルが出なくても
    // ブラウザ標準の console には未捕捉例外が残る。
    console.warn('[nosskey:debug] failed to start console viewer', describeError(err));
  }
}

/**
 * パネルが載ったことを DOM に知らせる。
 *
 * パネルは `position: fixed; bottom: 0` で画面下部を占有し、console-daijin が
 * 設定する `body { padding-bottom }` は fixed 要素を動かさない。つまりアプリ側の
 * 固定要素（フッターナビ・状態カードのボタン）はパネルの下敷きになり**タップ
 * できなくなる**。高さを CSS 変数で公開し、各コンポーネントがそれを避ける。
 */
function markPanelMounted(height: number): void {
  document.documentElement.style.setProperty('--nosskey-debug-panel-height', `${height}px`);
  document.body.classList.add('nosskey-debug-console');
}

/**
 * パネル冒頭に共有時の注意を出す。
 *
 * `[nosskey:debug]` 行は値を出さないが、**パネルはアプリ全体の console を
 * 無差別に取り込む**ため、他所のログや例外メッセージに秘密値が載る可能性まで
 * 消せるわけではない。ログ全文を貼り付けて共有する運用を前提にしている以上、
 * この非対称を読む人の目の前に置いておく必要がある。
 */
function warnAboutSharing(): void {
  console.warn(
    '[nosskey:debug] このパネルはアプリ全体の console を取り込みます。' +
      '[nosskey:debug] 行は値を出しませんが、他のログには秘密値が載りうるため、' +
      '共有前に全文を目視で確認してください。'
  );
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
  // `peekNosskeyManager()` はマネージャを新規構築しない。`hasKeyInfo()` 等の
  // 状態照会 API は副作用（メモリキャッシュ・salt 書き戻し）を持つので呼ばず、
  // ストレージハンドルだけを渡して診断側が getItem で直接読む。
  const manager = peekNosskeyManager();
  const storageOptions = manager?.getStorageOptions();
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
      storage: manager?.getStorageOptions().storage ?? null,
      storageKeys: manager
        ? [manager.getStorageOptions().storageKey, manager.getStorageOptions().registryStorageKey]
        : [],
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
