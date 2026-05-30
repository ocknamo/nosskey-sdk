<script lang="ts">
import { bytesToHex, hexToBytes } from 'nosskey-sdk';
import type { NostrKeyInfo } from 'nosskey-sdk';
import DeleteIcon from '../../assets/delete-icon.svg';
import NosskeyImage from '../../assets/nosskey.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import { accounts, initAccounts, removeAccount, upsertAccount } from '../../store/accounts.js';
import * as appState from '../../store/app-state.js';
import { hexToNpub, isValidNsec, nsecToHex } from '../../utils/bech32-converter.js';
import CardSection from '../ui/CardSection.svelte';
import HelpTip from '../ui/HelpTip.svelte';
import Button from '../ui/button/Button.svelte';
import IconButton from '../ui/button/IconButton.svelte';
import TabButton from '../ui/button/TabButton.svelte';

type AuthTab = 'login' | 'register';
type CreationMethod = 'new' | 'import';

let isLoading = $state(false);
let errorMessage = $state('');
// biome-ignore lint: svelte
let username = $state('');
let createdCredentialId = $state('');
let isPasskeyCreated = $state(false);
let activeTab = $state<AuthTab>(appState.hasLoggedInBefore() ? 'login' : 'register');
// biome-ignore lint: svelte
let creationMethod = $state<CreationMethod>('new');
let nsecInput = $state('');
let nsecError = $state('');
// 削除確認中のアカウント pubkey（2 段クリック確認用）。
let confirmDeletePubkey = $state('');

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
    const newCredentialId = await keyManager.createPasskey({
      user: {
        name: username || 'user@nosskey',
        displayName: username || 'user@nosskey',
      },
    });

    createdCredentialId = bytesToHex(newCredentialId);
    isPasskeyCreated = true;
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
      username: username || undefined,
    });
    keyManager.setCurrentKeyInfo(keyInfo);
    upsertAccount(keyInfo);

    // 二重防御: SDK 側でゼロ化済みだが UI 側のバッファ参照も明示的に消す。
    // 入力欄も即座にクリアして DOM 上に nsec を残さない。
    seckey.fill(0);
    nsecInput = '';

    const pubKey = await keyManager.getPublicKey();
    appState.publicKey.set(pubKey);
    appState.isLoggedIn.set(true);
    appState.markLoggedInBefore();
    appState.currentScreen.set('account');
  } catch (error) {
    seckey.fill(0);
    console.error('nsec インポートエラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.importNsec} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

async function login(credentialId?: string) {
  isLoading = true;
  errorMessage = '';

  try {
    const keyInfo = credentialId
      ? await keyManager.createNostrKey(hexToBytes(credentialId))
      : await keyManager.createNostrKey();

    keyManager.setCurrentKeyInfo(keyInfo);
    upsertAccount(keyInfo);

    const pubKey = await keyManager.getPublicKey();
    appState.publicKey.set(pubKey);
    appState.isLoggedIn.set(true);
    appState.markLoggedInBefore();

    appState.currentScreen.set('account');
  } catch (error) {
    console.error('ログインエラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.login} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

function shortNpub(pubkeyHex: string): string {
  try {
    const npub = hexToNpub(pubkeyHex);
    return `${npub.slice(0, 12)}…${npub.slice(-8)}`;
  } catch {
    return `${pubkeyHex.slice(0, 8)}…${pubkeyHex.slice(-8)}`;
  }
}

function accountLabel(account: NostrKeyInfo): string {
  return account.username?.trim() || shortNpub(account.pubkey);
}

async function reloginTo(account: NostrKeyInfo) {
  isLoading = true;
  errorMessage = '';
  try {
    await appState.relogin(account);
  } catch (error) {
    console.error('再ログインエラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.login} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

function doDelete(account: NostrKeyInfo) {
  // 一覧はログアウト中（current=null）にのみ描画されるため通常この分岐は通らないが、
  // 防御的に: 削除対象が current 鍵なら、ポインタも消してログイン状態をリセットする。
  if (keyManager.getCurrentKeyInfo()?.pubkey === account.pubkey) {
    keyManager.clearStoredKeyInfo();
    appState.publicKey.set(null);
    appState.isLoggedIn.set(false);
  }
  removeAccount(account.pubkey);
  confirmDeletePubkey = '';
}

function selectTab(tab: AuthTab) {
  activeTab = tab;
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
    {#if $accounts.length > 0}
      <CardSection title={$i18n.t.auth.accounts.title}>
        <ul class="account-list">
          {#each $accounts as account (account.pubkey)}
            <li class="account-row">
              <button
                type="button"
                class="account-relogin"
                onclick={() => reloginTo(account)}
                disabled={isLoading}
                title={$i18n.t.auth.accounts.relogin}
              >
                <span class="account-label">{accountLabel(account)}</span>
                {#if account.username?.trim()}
                  <span class="account-npub">{shortNpub(account.pubkey)}</span>
                {/if}
              </button>
              {#if confirmDeletePubkey === account.pubkey}
                <div class="account-confirm">
                  <Button
                    variant="danger"
                    size="small"
                    fullWidth={false}
                    onclick={() => doDelete(account)}
                  >
                    {$i18n.t.auth.accounts.confirmDelete}
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    fullWidth={false}
                    onclick={() => (confirmDeletePubkey = "")}
                  >
                    {$i18n.t.auth.accounts.cancel}
                  </Button>
                </div>
              {:else}
                <IconButton
                  onclick={() => (confirmDeletePubkey = account.pubkey)}
                  title={$i18n.t.auth.accounts.delete}
                  className="account-delete"
                >
                  <img src={DeleteIcon} alt={$i18n.t.auth.accounts.delete} />
                </IconButton>
              {/if}
            </li>
          {/each}
        </ul>
      </CardSection>
    {/if}

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
      <CardSection title={$i18n.t.auth.tabLogin}>
        {#snippet titleAside()}
          <HelpTip text={$i18n.t.auth.loginTip} placement="end" />
        {/snippet}
        <div class="tab-panel">
          <Button onclick={() => login()} disabled={isLoading} size="large">
            {$i18n.t.auth.loginWith}
          </Button>
        </div>
      </CardSection>
    {:else}
      <CardSection title={$i18n.t.auth.tabRegister}>
        {#snippet titleAside()}
          <HelpTip text={$i18n.t.auth.registerTip} placement="end" />
        {/snippet}
        <div class="tab-panel">
          {#if !isPasskeyCreated}
            <div class="creation-method-selector">
              <TabButton
                active={creationMethod === "new"}
                onclick={() => (creationMethod = "new")}
                className="creation-method-tab"
              >
                {$i18n.t.auth.methodNew}
              </TabButton>
              <TabButton
                active={creationMethod === "import"}
                onclick={() => (creationMethod = "import")}
                className="creation-method-tab"
              >
                {$i18n.t.auth.methodImport}
              </TabButton>
            </div>

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
            {/if}
          {:else}
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
                disabled
              />
            </div>
            <div class="success-message">
              <div class="success-icon">✅</div>
              <h4>{$i18n.t.auth.passkeyCreated}</h4>
              <p>{$i18n.t.auth.firstLogin}</p>
              <Button
                variant="success"
                onclick={() => login(createdCredentialId)}
                disabled={isLoading}
                className="success-action-button"
              >
                {$i18n.t.auth.proceedWithLogin}
              </Button>
            </div>
          {/if}
        </div>
      </CardSection>
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

  .account-list {
    list-style: none;
    margin: 0;
    padding: 0;
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
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
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

  .account-relogin:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .account-label {
    font-weight: 600;
  }

  .account-npub {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .account-confirm {
    display: flex;
    gap: 6px;
  }

  .auth-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    margin: 0 auto 20px;
  }

  .auth-tabs :global(.auth-tab) {
    flex: 1;
  }

  .creation-method-selector {
    display: flex;
    gap: 4px;
    padding: 4px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    margin: 0 0 20px 0;
  }

  .creation-method-selector :global(.creation-method-tab) {
    flex: 1;
  }

  .tab-panel {
    text-align: center;
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

  .success-message {
    padding: 20px;
    background-color: var(--color-success-bg);
    border: 2px solid var(--color-button-success);
    border-radius: 8px;
    text-align: center;
    margin: 16px 0;
  }

  .success-message h4 {
    color: var(--color-button-success);
    margin: 8px 0;
    font-size: 1.1rem;
  }

  .success-message p {
    margin: 8px 0 16px 0;
    color: var(--color-text-secondary);
  }

  .success-icon {
    font-size: 1.2rem;
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
