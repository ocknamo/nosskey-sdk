/**
 * 鍵が読めないまま届いたリクエストを「待つか、即座に諦めるか」の判定。
 *
 * `IframeHostScreen` の状態と SDK の鍵有無から決まる純粋関数として切り出し、
 * 方針をテストで固定できるようにする。
 */

/** `IframeHostScreen` が扱う UI 状態。 */
export type RecoveryUiState =
  | 'running'
  | 'partitioned'
  | 'denied'
  | 'granted'
  | 'noKeyExists'
  | 'unsupported';

export type RecoveryDecision =
  /** 既に鍵が読める。リクエストはそのまま進めてよい。 */
  | 'available'
  /** 回復の見込みが無い。即 `NO_KEY` を返す。 */
  | 'unrecoverable'
  /** ユーザーがストレージアクセスを許可すれば読める。操作を待つ。 */
  | 'wait';

/**
 * @param hasKeyInfo SDK が今この瞬間に鍵を読めるか
 * @param uiState 初期判定が確定させた画面状態
 *
 * `noKeyExists` / `unsupported` で待たないのが要点。前者は別タブでのパスキー登録、
 * 後者は Storage Access API 自体が無い環境で、どちらも親のリクエストタイムアウト
 * （既定 60 秒）内に解決しない。待てば必ずタイムアウトになるので、`NO_KEY` を
 * 早く返して親に判断させる方がよい。
 */
export function decideKeyRecovery(hasKeyInfo: boolean, uiState: RecoveryUiState): RecoveryDecision {
  if (hasKeyInfo) return 'available';
  if (uiState === 'noKeyExists' || uiState === 'unsupported') return 'unrecoverable';
  return 'wait';
}
