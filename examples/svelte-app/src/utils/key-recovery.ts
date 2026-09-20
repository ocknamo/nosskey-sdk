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
 * 待つのは **ユーザーがその場で決着させられるカードが出ている状態だけ** に限る。
 *
 * `partitioned` / `denied` は「アクセスを許可」と閉じるボタンがあり、許可すれば鍵が
 * 読めるようになる。それ以外で待つと詰む:
 * - `noKeyExists` は別タブでのパスキー登録待ちになり、親のリクエストタイムアウト
 *   （既定 60 秒）を必ず超える
 * - `unsupported` は Storage Access API 自体が無く、回復手段がない
 * - `running` / `granted` で鍵が無いのは本来あり得ない組み合わせだが、万一起きても
 *   前者はカードが描画されず、後者は成功表示で操作を促さないため、ユーザーが決着
 *   させる術がない
 *
 * @param hasKeyInfo SDK が今この瞬間に鍵を読めるか
 * @param uiState 初期判定が確定させた画面状態
 */
export function decideKeyRecovery(hasKeyInfo: boolean, uiState: RecoveryUiState): RecoveryDecision {
  if (hasKeyInfo) return 'available';
  return uiState === 'partitioned' || uiState === 'denied' ? 'wait' : 'unrecoverable';
}

/**
 * 初期判定を終えた直後に、iframe を**こちらから**開くべき状態か。
 *
 * 開くのは「ユーザーが動かない限り先に進めず、しかも誰もリクエストしてくれない
 * かもしれない」状態だけに絞る。`partitioned` / `denied` のように *待てば*
 * 解決する状態で開いてはいけない:
 *
 * - グラントは**ドキュメント単位**なので、親は iframe を作り直さず生かし続ける。
 *   すると初期判定はタブ復帰のたびに再実行される。そこで開くと「タブを切り替える
 *   たびにストレージ許可のモーダルが出る」ことになる。
 * - 鍵が実際に要る瞬間には host が `onKeyUnavailable` の直前に
 *   `nosskey:visibility` を出して開いてくれる。待てる状態はそこに任せれば、
 *   カードは**必要になった瞬間にだけ**出る。
 *
 * 判定そのものは {@link decideKeyRecovery} の裏返し: 「待てない（= リクエストが
 * 来ても解決しない）」状態だけが、こちらから見せる価値のある状態にあたる。
 * カードを描画しない `running` と、成功表示で操作を促さない `granted` は除く。
 */
export function shouldRevealOnDetection(uiState: RecoveryUiState): boolean {
  if (uiState === 'running' || uiState === 'granted') return false;
  return decideKeyRecovery(false, uiState) === 'unrecoverable';
}
