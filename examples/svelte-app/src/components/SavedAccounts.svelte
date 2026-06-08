<script lang="ts">
import type { NostrKeyInfo } from 'nosskey-sdk';
import { onDestroy } from 'svelte';
import { flip } from 'svelte/animate';
import { slide } from 'svelte/transition';
import DeleteIcon from '../assets/delete-icon.svg';
import LoginIcon from '../assets/login-icon.svg';
import { i18n } from '../i18n/i18n-store.js';
import { getNosskeyManager } from '../services/nosskey-manager.service.js';
import { accounts, removeAccount } from '../store/accounts.js';
import * as appState from '../store/app-state.js';
import { shortenNpub } from '../utils/bech32-converter.js';
import CardSection from './ui/CardSection.svelte';
import Button from './ui/button/Button.svelte';
import IconButton from './ui/button/IconButton.svelte';

interface Props {
  /** 再ログイン失敗時に親へエラーメッセージを通知する。 */
  onError?: (message: string) => void;
}
const { onError }: Props = $props();

const keyManager = getNosskeyManager();

// 削除確認中（確認ボタンを展開中）のアカウント pubkey。
let confirmDeletePubkey = $state('');
// 「本当に削除する」押下後、キャンセル猶予中のアカウント pubkey と残り秒数。
let pendingDeletePubkey = $state('');
let deleteRemaining = $state(0);
let deleteTimer: ReturnType<typeof setInterval> | null = null;
const DELETE_DELAY_SEC = 5;
// 再ログイン押下のタップフィードバックを見せるため、押下中ハイライトする pubkey。
let reloginPressedPubkey = $state('');
const RELOGIN_FEEDBACK_MS = 180;

function accountLabel(account: NostrKeyInfo): string {
  return account.username?.trim() || shortenNpub(account.pubkey);
}

async function reloginTo(account: NostrKeyInfo) {
  // 遅延フィードバック中は再入で relogin が二重キューされ current 鍵が競合しうる。
  if (reloginPressedPubkey !== '') return;
  // 再試行時に前回のエラーバナーを残さない。
  onError?.('');
  // 即座にログインすると押下フィードバックが見えないため、少しだけ間を置く。
  reloginPressedPubkey = account.pubkey;
  await new Promise((resolve) => setTimeout(resolve, RELOGIN_FEEDBACK_MS));
  try {
    await appState.loginWith(account);
  } catch (error) {
    console.error('再ログインエラー:', error);
    onError?.(
      `${$i18n.t.common.errorMessages.login} ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    reloginPressedPubkey = '';
  }
}

// ゴミ箱アイコン押下: 確認ボタンを展開する。
function startConfirm(account: NostrKeyInfo) {
  cancelDelete();
  confirmDeletePubkey = account.pubkey;
}

// 「本当に削除する」押下: 残り秒数をカウントダウンしながら猶予し、0 で実削除する。
function startPendingDelete(account: NostrKeyInfo) {
  pendingDeletePubkey = account.pubkey;
  deleteRemaining = DELETE_DELAY_SEC;
  deleteTimer = setInterval(() => {
    deleteRemaining -= 1;
    if (deleteRemaining <= 0) {
      if (deleteTimer) clearInterval(deleteTimer);
      deleteTimer = null;
      pendingDeletePubkey = '';
      confirmDeletePubkey = '';
      doDelete(account); // 行が消え、{#each} の out:slide で縦に閉じる
    }
  }, 1000);
}

// 確認 / 猶予中のキャンセル: 進行中のタイマーを止めて状態を戻す。
function cancelDelete() {
  if (deleteTimer) {
    clearInterval(deleteTimer);
    deleteTimer = null;
  }
  pendingDeletePubkey = '';
  confirmDeletePubkey = '';
}

function doDelete(account: NostrKeyInfo) {
  // 一覧はログアウト中（current=null）にのみ描画されるため通常この分岐は通らないが、
  // 防御的に: 削除対象が current 鍵なら、current ポインタのみ消してログイン状態を
  // リセットする（clearStoredKeyInfo だと登録簿ごと全消去してしまうため使わない）。
  // 登録簿の一意キーは pubkey + credentialId なので、判定も両方一致で行う
  // （同一 pubkey・別 credentialId のエントリ削除で current を巻き込まないため）。
  const current = keyManager.getCurrentKeyInfo();
  if (current?.pubkey === account.pubkey && current?.credentialId === account.credentialId) {
    keyManager.clearCurrentKeyInfo();
    appState.publicKey.set(null);
    appState.isLoggedIn.set(false);
  }
  // 該当アカウントのみ登録簿から削除する（pubkey + credentialId で特定）。
  removeAccount(account.pubkey, account.credentialId);
}

// アンマウント時に未発火のタイマーを破棄し、画面遷移後の遅延削除を防ぐ。
onDestroy(() => {
  if (deleteTimer) clearInterval(deleteTimer);
});
</script>

{#if $accounts.length > 0}
  <CardSection title={$i18n.t.auth.accounts.title}>
    <ul class="account-list">
      {#each $accounts as account (account.pubkey)}
        <li class="account-item" animate:flip={{ duration: 200 }} out:slide={{ duration: 200 }}>
          <div class="account-row">
            <button
              type="button"
              class="account-relogin"
              class:pressed={reloginPressedPubkey === account.pubkey}
              onclick={() => reloginTo(account)}
              disabled={reloginPressedPubkey !== "" && reloginPressedPubkey !== account.pubkey}
              title={$i18n.t.auth.accounts.relogin}
            >
              <span class="account-text">
                <span class="account-label">{accountLabel(account)}</span>
                {#if account.username?.trim()}
                  <span class="account-npub">{shortenNpub(account.pubkey)}</span>
                {/if}
              </span>
              <img class="account-login-icon" src={LoginIcon} alt="" aria-hidden="true" />
            </button>
            {#if confirmDeletePubkey !== account.pubkey}
              <IconButton
                onclick={() => startConfirm(account)}
                title={$i18n.t.auth.accounts.delete}
                className="account-delete"
              >
                <img src={DeleteIcon} alt={$i18n.t.auth.accounts.delete} />
              </IconButton>
            {/if}
          </div>
          {#if confirmDeletePubkey === account.pubkey}
            <div class="account-confirm" transition:slide={{ duration: 200 }}>
              <Button
                variant="danger"
                size="small"
                fullWidth={false}
                disabled={pendingDeletePubkey === account.pubkey}
                onclick={() => startPendingDelete(account)}
              >
                {#if pendingDeletePubkey === account.pubkey}
                  <span class="btn-spinner" aria-hidden="true"></span>
                  {$i18n.t.auth.accounts.confirmDelete} ({deleteRemaining})
                {:else}
                  {$i18n.t.auth.accounts.confirmDelete}
                {/if}
              </Button>
              <Button variant="secondary" size="small" fullWidth={false} onclick={cancelDelete}>
                {$i18n.t.auth.accounts.cancel}
              </Button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </CardSection>
{/if}

<style>
  .account-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .account-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .account-relogin {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }

  .account-relogin:hover:not(:disabled) {
    border-color: var(--color-button-primary);
  }

  /* タップ/クリックの押下フィードバック。即ログインで見えなくならないよう
     reloginTo() が少し遅延を入れ、その間 .pressed を付与して見せる。 */
  .account-relogin.pressed:not(:disabled),
  .account-relogin:active:not(:disabled) {
    border-color: var(--color-button-primary);
    background-color: var(--color-border-light);
  }

  .account-relogin:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .account-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }

  .account-login-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    opacity: 0.7;
  }

  .account-label {
    font-weight: 600;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-npub {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .account-confirm {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-right: 6px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
