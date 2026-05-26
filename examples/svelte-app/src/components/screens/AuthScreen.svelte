<script lang="ts">
import { bytesToHex, hexToBytes } from 'nosskey-sdk';
import NosskeyImage from '../../assets/nosskey.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import * as appState from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import HelpTip from '../ui/HelpTip.svelte';
import Button from '../ui/button/Button.svelte';
import TabButton from '../ui/button/TabButton.svelte';

type AuthTab = 'login' | 'register';

let isLoading = $state(false);
let errorMessage = $state('');
// biome-ignore lint: svelte
let username = $state('');
let createdCredentialId = $state('');
let isPasskeyCreated = $state(false);
let activeTab = $state<AuthTab>('login');

const keyManager = getNosskeyManager();

async function initialize() {
  isLoading = true;
  try {
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

async function login(credentialId?: string) {
  isLoading = true;
  errorMessage = '';

  try {
    const keyInfo = credentialId
      ? await keyManager.createNostrKey(hexToBytes(credentialId))
      : await keyManager.createNostrKey();

    keyManager.setCurrentKeyInfo(keyInfo);

    const pubKey = await keyManager.getPublicKey();
    appState.publicKey.set(pubKey);
    appState.isLoggedIn.set(true);

    appState.currentScreen.set('account');
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
      <CardSection title={$i18n.t.auth.tabLogin}>
        <div class="tab-panel">
          <div class="panel-help">
            <HelpTip text={$i18n.t.auth.loginTip} />
          </div>

          <Button onclick={() => login()} disabled={isLoading} size="large">
            {$i18n.t.auth.loginWith}
          </Button>
        </div>
      </CardSection>
    {:else}
      <CardSection title={$i18n.t.auth.tabRegister}>
        <div class="tab-panel">
          <div class="panel-help">
            <HelpTip text={$i18n.t.auth.registerTip} />
          </div>

          <div class="username-input">
            <div class="username-label-row">
              <label for="username">{$i18n.t.auth.username}</label>
              <HelpTip text={$i18n.t.auth.usernameTip} />
            </div>
            <input
              id="username"
              type="text"
              bind:value={username}
              placeholder={$i18n.t.auth.usernamePlaceholder}
              disabled={isLoading}
            />
          </div>

          {#if !isPasskeyCreated}
            <Button onclick={createNew} disabled={isLoading} size="large">
              {$i18n.t.auth.createNew}
            </Button>
          {:else}
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
    max-width: 640px;
    margin: 0 auto;
    padding: 20px;
    text-align: center;
  }

  .hero-section {
    margin-bottom: 32px;
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

  .auth-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    margin: 0 auto 20px;
    max-width: 360px;
  }

  .auth-tabs :global(.auth-tab) {
    flex: 1;
  }

  .tab-panel {
    text-align: left;
  }

  .panel-help {
    display: flex;
    justify-content: flex-end;
    margin: 0 0 8px 0;
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
    .auth-container {
      padding: 15px 10px;
    }

    .screen-title {
      font-size: 1.8rem;
    }
  }
</style>
