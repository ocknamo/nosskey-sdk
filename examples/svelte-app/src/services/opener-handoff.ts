/**
 * スタンドアロンタブ ⇔ iframe 間で `NostrKeyInfo` をライブ受け渡しする内部
 * プロトコル。`packages/nosskey-iframe` のプロトコル（親 ⇔ iframe）とは別物。
 *
 * 流れ:
 *   1. iframe (`IframeHostScreen`) が `window.open(...)` で同一 origin の
 *      スタンドアロン画面を開く（`noopener` なし）。
 *   2. スタンドアロン側でパスキー登録/ログインが成功した直後に
 *      `notifyOpenerIfSameOrigin(keyInfo)` を呼ぶ。
 *   3. iframe が `message` イベントを受信し、`isStandaloneHandoffMessage` で
 *      検証してから `manager.setCurrentKeyInfo(keyInfo)` を呼ぶ。
 *
 * 安全性: postMessage の targetOrigin は自 origin に絞り、受信側は
 * `event.origin === window.location.origin` と `event.source === openedWindow`
 * の二重ガードで偽装を弾く。
 */
import type { NostrKeyInfo } from 'nosskey-sdk';

export const STANDALONE_HANDOFF_TYPE = 'nosskey:standalone-key-registered' as const;

export interface StandaloneHandoffMessage {
  type: typeof STANDALONE_HANDOFF_TYPE;
  keyInfo: NostrKeyInfo;
}

export function isStandaloneHandoffMessage(value: unknown): value is StandaloneHandoffMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.type !== STANDALONE_HANDOFF_TYPE) return false;
  const ki = v.keyInfo as Record<string, unknown> | undefined;
  if (!ki || typeof ki !== 'object') return false;
  return (
    typeof ki.credentialId === 'string' &&
    typeof ki.pubkey === 'string' &&
    typeof ki.salt === 'string'
  );
}

/**
 * `window.opener` が存在して同一 origin なら、`StandaloneHandoffMessage` を
 * 送信する。opener が無い・閉じられた・cross-origin なら何もしない。
 *
 * @param keyInfo 送信する NostrKeyInfo（秘密鍵を含まない公開情報）
 * @param win テスト用に注入可能な `Window`。デフォルトは `globalThis.window`。
 */
export function notifyOpenerIfSameOrigin(keyInfo: NostrKeyInfo, win: Window = window): void {
  const opener = win.opener as Window | null;
  if (!opener || opener === win) return;
  try {
    const message: StandaloneHandoffMessage = {
      type: STANDALONE_HANDOFF_TYPE,
      keyInfo,
    };
    // targetOrigin に自 origin を指定することで、opener が cross-origin へ
    // ナビゲートしていればブラウザが unmatched targetOrigin としてメッセージを
    // 破棄する。同一 origin チェックは SDK 内で能動的に行うのではなく、ブラウザ
    // の postMessage targetOrigin マッチに委譲している。
    opener.postMessage(message, win.location.origin);
  } catch {
    /* opener が閉じられている等は無害 */
  }
}

/**
 * iframe 側で受け取った `MessageEvent` がスタンドアロンタブからの正当な
 * `StandaloneHandoffMessage` か判定し、その場合は keyInfo を返す。
 *
 * 二重ガード:
 *  - `event.origin === expectedOrigin` （自 origin のみ）
 *  - `event.source === expectedSource` （自分が `window.open` したタブのみ）
 *
 * いずれも満たさない場合・message 形式が不正な場合は `null` を返し、呼び出し元は
 * 何もしない。Svelte コンポーネントから抽出してテスト可能にしている。
 */
export function processStandaloneHandoff(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  expected: { origin: string; source: Window | null }
): NostrKeyInfo | null {
  if (event.origin !== expected.origin) return null;
  if (!expected.source || event.source !== expected.source) return null;
  if (!isStandaloneHandoffMessage(event.data)) return null;
  return event.data.keyInfo;
}
