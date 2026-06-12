<script lang="ts">
import { hexToBytes } from 'nosskey-sdk';
import NosskeyImage from '../../assets/nosskey.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import { initAccounts } from '../../store/accounts.js';
import * as appState from '../../store/app-state.js';
import { isValidNsec, nsecToHex } from '../../utils/bech32-converter.js';
import SavedAccounts from '../SavedAccounts.svelte';
import HelpTip from '../ui/HelpTip.svelte';
import Button from '../ui/button/Button.svelte';
import TabButton from '../ui/button/TabButton.svelte';

type AuthTab = 'login' | 'register';
type CreationMethod = 'new' | 'import';

let isLoading = $state(false);
let errorMessage = $state('');
// biome-ignore lint: svelte
let username = $state('');
let activeTab = $state<AuthTab>(appState.hasLoggedInBefore() ? 'login' : 'register');
let creationMethod = $state<CreationMethod>('new');
let nsecInput = $state('');
let nsecError = $state('');

const keyManager = getNosskeyManager();

async function initialize() {
  isLoading = true;
  try {
    // 一覧表示前にアカウント登録簿を初期化（既存ユーザーは current 鍵を移行）。
    initAccounts();
    if (keyManager.hasKeyInfo()) {
      const pubKey = await keyManager.getPublicKey();
      appState.publicKey.set(pubKey);
      appState.isLoggedIn.set(true);
      return;
    }
  } catch (error) {
    console.error('初期化エラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.init} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

async function createNew() {
  isLoading = true;
  errorMessage = '';

  try {
    // createPasskey（WebAuthn create）で標準 salt の PRF が #pendingPrfByCredId に
    // キャッシュされるため、続く createNostrKey はそれを消費して 2 回目の get()（UV）を
    // 省ける。nsec インポート経路（createPasskey → importNostrKey）と対称に、create と
    // 鍵生成・ログインを 1 ボタン・1 UV に統合する。create 時に PRF を返さないブラウザでは
    // createNostrKey 内で getPrfSecret() に自動フォールバックする（その場合のみ追加 UV）。
    const newCredentialId = await keyManager.createPasskey({
      user: {
        name: username || 'user@nosskey',
        displayName: username || 'user@nosskey',
      },
    });
    const keyInfo = await keyManager.createNostrKey(newCredentialId, {
      username: username.trim() || undefined,
    });

    await appState.loginWith(keyInfo);
  } catch (error) {
    console.error('パスキー作成エラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.passkeyCreation} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

async function importExisting() {
  isLoading = true;
  errorMessage = '';
  nsecError = '';

  const trimmed = nsecInput.trim();
  if (!isValidNsec(trimmed)) {
    nsecError = $i18n.t.auth.invalidNsec;
    isLoading = false;
    return;
  }
  const nsecHex = nsecToHex(trimmed);
  if (!nsecHex) {
    nsecError = $i18n.t.auth.invalidNsec;
    isLoading = false;
    return;
  }
  const seckey = hexToBytes(nsecHex);
  // nsecToHex は bech32 デコードと prefix チェックのみで 32B を保証しない。
  // SDK 側でも検証するが、UI レイヤで早期に弾いて分かりやすいメッセージを出す。
  if (seckey.length !== 32) {
    seckey.fill(0);
    nsecError = $i18n.t.auth.invalidNsec;
    isLoading = false;
    return;
  }

  try {
    const newCredentialId = await keyManager.createPasskey({
      user: {
        name: username || 'user@nosskey',
        displayName: username || 'user@nosskey',
      },
    });
    const keyInfo = await keyManager.importNostrKey(seckey, newCredentialId, {
      username: username.trim() || undefined,
    });

    // 二重防御: SDK 側でゼロ化済みだが UI 側のバッファ参照も明示的に消す。
    // 入力欄も即座にクリアして DOM 上に nsec を残さない。
    seckey.fill(0);
    nsecInput = '';

    await appState.loginWith(keyInfo);
  } catch (error) {
    seckey.fill(0);
    console.error('nsec インポートエラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.importNsec} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

async function login() {
  isLoading = true;
  errorMessage = '';

  try {
    // ログインタブ: credentialId を渡さず、ユーザーに既存パスキーを選択させて get()/PRF で
    // 鍵を導出する（resident key 前提）。新規作成は createNew() に統合済み。
    const keyInfo = await keyManager.createNostrKey();

    await appState.loginWith(keyInfo);
  } catch (error) {
    console.error('ログインエラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.login} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

function selectTab(tab: AuthTab) {
  activeTab = tab;
  errorMessage = '';
  // タブ切替でも入力途中の nsec を state/DOM に残さない（「戻る」経路と同じ破棄方針）。
  showNew();
}

function showImport() {
  creationMethod = 'import';
  errorMessage = '';
}

function showNew() {
  // 新規作成モードへ戻す共通処理（「戻る」リンク・タブ切替の双方から呼ぶ）。
  // 入力途中の nsec を state/DOM から確実に消し、秘密鍵を残さない。
  creationMethod = 'new';
  nsecInput = '';
  nsecError = '';
  errorMessage = '';
}

$effect(() => {
  initialize();
});
</script>

<div class="auth-container">
  <div class="hero-section">
    <img src={NosskeyImage} alt="Nosskey hero" width="80" height="80" />
    <h1 class="screen-title">{$i18n.t.auth.title}</h1>
    <p class="subtitle">{$i18n.t.auth.subtitle}</p>
  </div>

  {#if isLoading}
    <div class="loading-section">
      <div class="loading-spinner"></div>
      <p>{$i18n.t.auth.loading}</p>
    </div>
  {:else}
    <div class="auth-tabs">
      <TabButton
        active={activeTab === "login"}
        onclick={() => selectTab("login")}
        className="auth-tab"
      >
        {$i18n.t.auth.tabLogin}
      </TabButton>
      <TabButton
        active={activeTab === "register"}
        onclick={() => selectTab("register")}
        className="auth-tab"
      >
        {$i18n.t.auth.tabRegister}
      </TabButton>
    </div>

    {#if activeTab === "login"}
      <SavedAccounts onError={(message) => (errorMessage = message)} />
      <div class="tab-panel">
        <Button onclick={() => login()} disabled={isLoading} size="large">
          {$i18n.t.auth.loginWith}
        </Button>
      </div>
    {:else}
      <div class="tab-panel">
        <div class="username-input">
          <div class="username-label-row">
            <label for="username">{$i18n.t.auth.username}</label>
            <HelpTip text={$i18n.t.auth.usernameTip} placement="start" />
          </div>
          <input
            id="username"
            type="text"
            bind:value={username}
            placeholder={$i18n.t.auth.usernamePlaceholder}
            disabled={isLoading}
          />
        </div>

        {#if creationMethod === "new"}
          <Button onclick={createNew} disabled={isLoading} size="large">
            {$i18n.t.auth.createNew}
          </Button>
          <div class="method-link-row">
            <button
              type="button"
              class="method-link"
              onclick={showImport}
              disabled={isLoading}
            >
              {$i18n.t.auth.methodImport}
            </button>
          </div>
        {:else}
          <div class="nsec-input">
            <div class="nsec-label-row">
              <label for="nsec">{$i18n.t.auth.nsecLabel}</label>
              <HelpTip text={$i18n.t.auth.nsecTip} placement="start" />
            </div>
            <input
              id="nsec"
              type="password"
              autocomplete="off"
              spellcheck="false"
              bind:value={nsecInput}
              placeholder={$i18n.t.auth.nsecPlaceholder}
              disabled={isLoading}
            />
            {#if nsecError}
              <div class="error-message">{nsecError}</div>
            {/if}
          </div>
          <Button
            onclick={importExisting}
            disabled={isLoading || !nsecInput.trim()}
            size="large"
          >
            {$i18n.t.auth.importNsec}
          </Button>
          <div class="method-link-row">
            <button
              type="button"
              class="method-link"
              onclick={showNew}
              disabled={isLoading}
            >
              {$i18n.t.common.back}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  {#if errorMessage}
    <div class="error-message main">
      <span class="error-icon">⚠️</span>
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .auth-container {
    max-width: 700px;
    /* 親 .account-screen は flex column のため、cross-axis に auto margin を置くと
       free space を吸収して shrink-to-fit になる。stretch に任せるため 0 にする。 */
    margin: 0;
    padding: 20px;
    text-align: center;
  }

  @media (max-width: 600px) {
    .auth-container {
      padding: 12px 8px;
    }
  }

  .hero-section {
    margin-bottom: 32px;
  }

  .hero-section img {
    border-radius: 16px;
  }

  .screen-title {
    font-size: 2.2rem;
    font-weight: 700;
    margin: 16px 0 8px 0;
    color: var(--color-text-primary);
  }

  .subtitle {
    font-size: 1.1rem;
    color: var(--color-text-secondary);
    margin-bottom: 0;
    line-height: 1.5;
    text-align: center;
  }

  .loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 40px 20px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border-light);
    border-top: 3px solid var(--color-button-primary);
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

  .auth-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background-color: var(--color-surface);
    border: var(--border-width, 1px) solid var(--color-border);
    border-radius: 10px;
    margin: 0 auto 20px;
  }

  .auth-tabs :global(.auth-tab) {
    flex: 1;
  }

  .tab-panel {
    text-align: center;
  }

  .method-link-row {
    margin-top: 16px;
    text-align: center;
  }

  .method-link {
    background: none;
    border: none;
    padding: 4px;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    text-decoration: underline;
    cursor: pointer;
  }

  .method-link:hover:not(:disabled) {
    color: var(--color-text-primary);
  }

  .method-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nsec-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 20px 0;
    text-align: left;
  }

  .nsec-label-row {
    display: flex;
    align-items: center;
  }

  .nsec-label-row label {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .nsec-input input {
    padding: 12px;
    border-radius: 6px;
    border: 2px solid var(--color-border-medium);
    font-size: 1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    transition: border-color 0.2s ease;
  }

  .nsec-input input:focus {
    outline: none;
    border-color: var(--color-button-primary);
  }

  .username-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 20px 0;
    text-align: left;
  }

  .username-label-row {
    display: flex;
    align-items: center;
  }

  .username-label-row label {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .username-input input {
    padding: 12px;
    border-radius: 6px;
    border: 2px solid var(--color-border-medium);
    font-size: 1rem;
    transition: border-color 0.2s ease;
  }

  .username-input input:focus {
    outline: none;
    border-color: var(--color-button-primary);
  }

  .error-message {
    padding: 12px 16px;
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border: 1px solid var(--color-error);
    border-radius: 6px;
    margin: 12px 0;
    font-size: 0.9rem;
    text-align: left;
  }

  .error-message.main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 24px 0;
    text-align: center;
    justify-content: center;
  }

  .error-icon {
    font-size: 1.1rem;
  }

  @media (max-width: 480px) {
    .screen-title {
      font-size: 1.8rem;
    }
  }
</style>
