import { type NostrKeyInfo, isNostrKeyInfo } from 'nosskey-sdk';
import { writable } from 'svelte/store';
import { peekNosskeyManager } from '../services/nosskey-manager.service.js';

/**
 * 退避用アカウント登録簿の svelte 層。
 *
 * 登録簿の実体（永続化・upsert・salt 正規化・単一スロットからの移行）は SDK 本体
 * （`NosskeyManager` の `listKeyInfos` / `removeKeyInfo` / `setCurrentKeyInfo` の upsert）
 * が所有する。本モジュールは SDK の登録簿を読み出して UI 用の writable store へ反映する
 * 薄いリアクティブ層に徹する。SDK が current 鍵を書く単一スロット（`nosskey_pwk`）とは
 * 独立した別キー（`nosskey_accounts`）に保持されるため、logout（`clearCurrentKeyInfo`）後も
 * 復元不能な wrap モードの暗号文が失われず、一覧から再ログインできる。
 */

// 保存値検証は SDK 側のものを再公開する（ImportKeyInfo / key-info-export が利用）。
export { isNostrKeyInfo };

/** リアクティブ UI 用のアカウント一覧ストア。 */
export const accounts = writable<NostrKeyInfo[]>([]);

/** SDK 登録簿から svelte store を再同期する。SDK 登録簿を変更したあとに呼ぶ。 */
export function refreshAccounts(): void {
  accounts.set(peekNosskeyManager()?.listKeyInfos() ?? []);
}

/** 現在の登録簿を返す（SDK 登録簿のスナップショット）。 */
export function listAccounts(): NostrKeyInfo[] {
  return peekNosskeyManager()?.listKeyInfos() ?? [];
}

/** `pubkey + credentialId` 一致のアカウントを SDK 登録簿から削除し、store を同期する。 */
export function removeAccount(pubkey: string, credentialId: string): void {
  peekNosskeyManager()?.removeKeyInfo(pubkey, credentialId);
  refreshAccounts();
}

let initialized = false;

/**
 * 登録簿を初期化する（1 回限り）。SDK マネージャ構築後に呼ぶこと。
 * 単一スロットの既存ユーザーからの移行は SDK 側が lazy に行うため、ここでは
 * SDK 登録簿を読み出して store へ反映するだけでよい。
 */
export function initAccounts(): void {
  if (initialized) return;
  initialized = true;
  refreshAccounts();
}
