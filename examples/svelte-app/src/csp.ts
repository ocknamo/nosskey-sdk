/**
 * Content-Security-Policy の正準定義。
 *
 * 秘密鍵を扱うホストアプリに対する XSS 多層防御（セキュリティ診断 2026-06-10 の
 * M-3）。本番では `public/_headers`（Cloudflare Pages）で配信し、開発・preview
 * サーバーでは `vite.config.ts` のプラグインが同じ値を付与する。両者が乖離しない
 * よう `csp.spec.ts` が `_headers` に本定数が含まれることを検証する。
 *
 * 設計上の要点:
 * - `script-src 'self'`: インライン/外部の注入スクリプトを止める XSS 対策の核。
 *   `'unsafe-inline'` を **付けない**ことが防御の本体。
 * - `style-src ... 'unsafe-inline' ...googleapis`: Svelte はスタイルをインライン
 *   注入するため style に限り inline を許可。Google Fonts の CSS も通す。
 * - `connect-src ... wss: ws:`: ユーザーが設定する任意の Nostr リレーへの
 *   WebSocket。個別ドメインを列挙できないため scheme 単位で許可する。アプリの
 *   リレー入力は `wss://` / `ws://` 双方を受理する（`isValidRelayUrl`）ため両方を
 *   許可し挙動を一致させる。なお本番（https 配信）では `ws://`（平文）はブラウザの
 *   mixed-content 規制で遮断されるため、実害はローカル開発の `ws://` 利用に限られる。
 * - `frame-ancestors *`: nosskey は「任意サイトが署名 iframe を埋め込む」オープン
 *   埋め込みモデルが設計意図のため全許可。ここを閉じると iframe モードが壊れる。
 */
const CSP_DIRECTIVES: string[] = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' wss: ws: https:",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'frame-ancestors *',
];

/** 1 行にまとめた Content-Security-Policy ヘッダー値。 */
export const CONTENT_SECURITY_POLICY: string = CSP_DIRECTIVES.join('; ');
