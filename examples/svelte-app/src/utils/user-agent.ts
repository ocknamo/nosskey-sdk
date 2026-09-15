/**
 * UA 文字列からの WebKit 推定。`IframeHostScreen` の Storage Access グラント後の
 * 分岐（cookie フォールバックに倒すか否か）と、計測用の診断ログの双方から参照する。
 *
 * 両者が別実装だとログが実際の分岐と食い違い、調査が破綻するため 1 箇所に集約する。
 */

/**
 * iOS / iPadOS では Apple のポリシーで全ブラウザが WebKit を使うため、
 * CriOS (iOS Chrome) / FxiOS (iOS Firefox) / EdgiOS (iOS Edge) すべて
 * Safari と同じ Storage Access API の制約（cookie のみ unpartition、
 * localStorage は partition のまま）を受ける。よって関数名は「Safari」
 * 限定ではなく「WebKit」とする。
 *
 * **既知の限界**: WKWebView ベースのアプリ内ブラウザ（X / Threads / LINE 等）は
 * UA に `Safari` を含まないことがあり、その場合 false を返す。実機調査で
 * アプリ内ブラウザが対象になる場合はこの判定自体を疑うこと。
 */
export function isLikelyWebKit(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return false;
  // デスクトップ Chromium / Android Chrome / デスクトップ Edge は UA に
  // "Safari" を含むが本来の WebKit ではないので除外する。
  return /Safari/.test(ua) && !/Chrome|Chromium|Android|Edg\//.test(ua);
}
