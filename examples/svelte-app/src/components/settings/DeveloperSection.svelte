<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';
import ToggleButton from '../ui/button/ToggleButton.svelte';

let isLoading = $state(false);
let errorMessage = $state('');
let isPrfChecked = $state(false);
let isSupported = $state(false);
// biome-ignore lint: svelte
let expanded = $state(false);

const keyManager = getNosskeyManager();

async function checkPrfSupport() {
  isLoading = true;
  errorMessage = '';
  try {
    isSupported = await keyManager.isPrfSupported();
    isPrfChecked = true;
  } catch (error) {
    console.error('PRF対応確認エラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.prfCheck} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

function getUnsupportedMessage() {
  const isChrome = navigator.userAgent.indexOf('Chrome') > -1;
  const isFirefox = navigator.userAgent.indexOf('Firefox') > -1;

  if (isChrome) {
    return 'Chrome では chrome://flags から #enable-webauthn-new-discovery-mechanism と #enable-webauthn-extensions を有効にしてください。';
  }

  if (isFirefox) {
    return 'Firefox では about:config から webauthn:enable_prf を true に設定してください。';
  }

  return 'お使いのブラウザでは WebAuthn PRF 拡張がサポートされていません。Chrome または Firefox の最新版をお試しください。';
}
</script>

<div class="developer-section">
  <ToggleButton
    onclick={() => (expanded = !expanded)}
    {expanded}
    size="small"
    className="toggle-section-button small"
  >
    {$i18n.t.settings.developer.title}
  </ToggleButton>

  {#if expanded}
    <CardSection title="">
      <div class="developer-content">
        <p class="developer-description">
          {$i18n.t.settings.developer.description}
        </p>

        {#if !isPrfChecked}
          <Button
            variant="secondary"
            onclick={checkPrfSupport}
            disabled={isLoading}
            size="small"
            className="developer-action-button"
          >
            {$i18n.t.settings.developer.checkPrf}
          </Button>
        {:else if !isSupported}
          <div class="error-message">
            <h4>{$i18n.t.settings.developer.prfUnsupportedTitle}</h4>
            <p>{getUnsupportedMessage()}</p>
          </div>
        {:else}
          <div class="success-message small">
            <span class="success-icon">✅</span>
            <p>{$i18n.t.settings.developer.prfSupported}</p>
          </div>
        {/if}

        {#if errorMessage}
          <div class="error-message">{errorMessage}</div>
        {/if}
      </div>
    </CardSection>
  {/if}
</div>

<style>
  .developer-section {
    margin-top: 16px;
  }

  .developer-content {
    text-align: left;
  }

  .developer-description {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin-bottom: 16px;
  }

  .success-message.small {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    text-align: left;
    background-color: var(--color-success-bg);
    border: 2px solid var(--color-button-success);
    border-radius: 8px;
    margin: 16px 0;
  }

  .success-message.small p {
    margin: 0;
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

  .error-message h4 {
    margin: 0 0 8px 0;
  }
</style>
