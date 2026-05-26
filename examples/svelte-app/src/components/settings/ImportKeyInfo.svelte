<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import * as appState from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';
import FileInputButton from '../ui/button/FileInputButton.svelte';
import ToggleButton from '../ui/button/ToggleButton.svelte';

let isLoading = $state(false);
// biome-ignore lint: svelte
let showKeyInfoTextarea = $state(false);
// biome-ignore lint: svelte
let keyInfoTextInput = $state('');
let keyInfoImportError = $state('');

const keyManager = getNosskeyManager();

async function handleKeyInfoFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  isLoading = true;
  keyInfoImportError = '';

  try {
    const fileContent = await file.text();
    await loginWithKeyInfoData(fileContent);
  } catch (error) {
    console.error('KeyInfoファイル読み込みエラー:', error);
    keyInfoImportError = `ファイル読み込みエラー: ${error instanceof Error ? error.message : String(error)}`;
    isLoading = false;
  }
}

async function loginWithKeyInfoText() {
  if (!keyInfoTextInput) return;

  isLoading = true;
  keyInfoImportError = '';

  try {
    await loginWithKeyInfoData(keyInfoTextInput);
  } catch (error) {
    console.error('KeyInfoテキスト処理エラー:', error);
    keyInfoImportError = `KeyInfo処理エラー: ${error instanceof Error ? error.message : String(error)}`;
    isLoading = false;
  }
}

async function loginWithKeyInfoData(keyInfoJsonText: string) {
  try {
    const keyData = JSON.parse(keyInfoJsonText);

    if (!keyData.v || !keyData.alg || !keyData.credentialId || !keyData.pubkey) {
      throw new Error('有効なKeyInfoデータではありません');
    }

    keyManager.setCurrentKeyInfo(keyData);

    const pubKey = await keyManager.getPublicKey();
    appState.publicKey.set(pubKey);
    appState.isLoggedIn.set(true);

    appState.currentScreen.set('account');
  } catch (error) {
    console.error('KeyInfoログインエラー:', error);
    throw new Error(
      `KeyInfoログインエラー: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    isLoading = false;
  }
}
</script>

<CardSection title={$i18n.t.settings.import.title}>
  <div class="key-info-import-section">
    <p class="section-description">{$i18n.t.settings.import.description}</p>

    <div class="key-info-input-container">
      <FileInputButton
        onchange={handleKeyInfoFileUpload}
        accept="application/json"
        disabled={isLoading}
        inputId="key-info-file-input"
      >
        {$i18n.t.settings.import.fileSelect}
      </FileInputButton>

      <div class="divider">
        <span>{$i18n.t.settings.import.or}</span>
      </div>

      <ToggleButton
        onclick={() => (showKeyInfoTextarea = !showKeyInfoTextarea)}
        expanded={showKeyInfoTextarea}
        size="small"
        className="toggle-text-input-button"
      >
        {$i18n.t.settings.import.dataInput}
      </ToggleButton>
    </div>

    {#if showKeyInfoTextarea}
      <div class="key-info-textarea-container">
        <textarea
          bind:value={keyInfoTextInput}
          placeholder={$i18n.t.settings.import.dataPlaceholder}
          class="key-info-textarea"
        ></textarea>
        <Button
          variant="success"
          onclick={loginWithKeyInfoText}
          disabled={isLoading || !keyInfoTextInput}
          className="key-info-login-button"
        >
          {isLoading
            ? $i18n.t.settings.import.processing
            : $i18n.t.settings.import.loginButton}
        </Button>
      </div>
    {/if}

    {#if keyInfoImportError}
      <div class="error-message">
        {keyInfoImportError}
      </div>
    {/if}
  </div>
</CardSection>

<style>
  .key-info-import-section {
    text-align: left;
  }

  .section-description {
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin-bottom: 20px;
  }

  .key-info-input-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 16px 0;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 8px 0;
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background-color: var(--color-border-medium);
  }

  .divider span {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .key-info-textarea-container {
    margin-top: 16px;
  }

  .key-info-textarea {
    width: 100%;
    height: 120px;
    padding: 12px;
    border: 2px solid var(--color-border-medium);
    border-radius: 6px;
    font-family: ui-monospace, "Courier New", monospace;
    font-size: 0.85rem;
    resize: vertical;
    margin-bottom: 12px;
    transition: border-color 0.2s ease;
  }

  .key-info-textarea:focus {
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
</style>
