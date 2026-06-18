// 認証フロー（パスキー作成・ログイン・nsec インポート・再ログイン）で投げられた
// エラーをユーザー向け文言に整形する共通ロジック。
//
// PRF 拡張に対応しない認証器（Bitwarden など）では SDK が PRF 由来のエラーを投げる。
// 生のメッセージ（"PRF secret not available" 等）は分かりにくいため、別パスキーを
// 試すよう促す案内文へ差し替える。

/** SDK が投げる PRF 由来のエラーかどうかを判定する。 */
export function isPrfUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  // prf-handler の "PRF secret not available"（PRF 結果が返らない）と、
  // nosskey の "Invalid PRF output: all zeros"（PRF が無効値）を拾う。
  return message.includes('PRF secret not available') || message.includes('Invalid PRF output');
}

/**
 * エラーをユーザー向け文言に整形する。
 * PRF 非対応のときは案内文のみを返し、それ以外はプレフィックス + 生メッセージを返す。
 */
export function formatAuthError(
  prefix: string,
  prfUnsupportedMessage: string,
  error: unknown
): string {
  if (isPrfUnsupportedError(error)) {
    return prfUnsupportedMessage;
  }
  return `${prefix} ${error instanceof Error ? error.message : String(error)}`;
}
