<script lang="ts">
  import { i18n } from "../../i18n/i18n-store.js";
  import {
    clearSecretCache,
    getNosskeyManager,
  } from "../../services/nosskey-manager.service.js";
  import { cacheSecrets, cacheTimeout } from "../../store/app-state.js";
  import CardSection from "../ui/CardSection.svelte";
  import Button from "../ui/button/Button.svelte";

  // 状態変数
  let cacheSettingMessage = $state("");
  let isCaching = $state(true);
  let timeoutSeconds = $state(300); // デフォルト5分（300秒）

  // ストアを監視して更新
  cacheSecrets.subscribe((value) => {
    isCaching = value;
  });

  cacheTimeout.subscribe((value) => {
    timeoutSeconds = value;
  });

  // NosskeyManagerのシングルトンインスタンスを取得
  const keyManager = getNosskeyManager();

  // キャッシュ設定を更新する関数
  function updateCacheSetting(value: boolean) {
    // storeを更新（keyManager.serviceがサブスクライブして自動的に反映）
    cacheSecrets.set(value);

    cacheSettingMessage = $i18n.t.settings.cacheSettings.saved;
    setTimeout(() => {
      cacheSettingMessage = "";
    }, 3000);
  }

  // タイムアウト設定を更新
  function updateTimeoutSetting(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = Number.parseInt(input.value, 10);

    if (!Number.isNaN(value) && value > 0) {
      timeoutSeconds = value;
      cacheTimeout.set(value); // keyManager.serviceがサブスクライブして自動的に反映

      cacheSettingMessage = $i18n.t.settings.cacheSettings.saved;
      setTimeout(() => {
        cacheSettingMessage = "";
      }, 3000);
    }
  }

  // キャッシュをクリアする関数
  function clearCache() {
    const success = clearSecretCache();

    if (success) {
      cacheSettingMessage = $i18n.t.settings.cacheSettings.clearSuccess;
    } else {
      cacheSettingMessage = $i18n.t.settings.cacheSettings.clearError;
    }

    // 3秒後にメッセージをクリア
    setTimeout(() => {
      cacheSettingMessage = "";
    }, 3000);
  }
</script>

<CardSection title={$i18n.t.settings.cacheSettings.title}>
  <p>
    {$i18n.t.settings.cacheSettings.description}
  </p>

  <div class="cache-settings">
    <div class="radio-group">
      <label>
        <input
          type="radio"
          name="cache-setting"
          value="true"
          checked={isCaching}
          onclick={() => updateCacheSetting(true)}
        />
        {$i18n.t.settings.cacheSettings.enabled}
      </label>
      <label>
        <input
          type="radio"
          name="cache-setting"
          value="false"
          checked={!isCaching}
          onclick={() => updateCacheSetting(false)}
        />
        {$i18n.t.settings.cacheSettings.disabled}
      </label>
    </div>

    {#if isCaching}
      <div class="timeout-setting">
        <label for="timeout-seconds"
          >{$i18n.t.settings.cacheSettings.timeoutLabel}：</label
        >
        <input
          id="timeout-seconds"
          type="number"
          min="10"
          max="86400"
          value={timeoutSeconds}
          onchange={updateTimeoutSetting}
        />
      </div>
    {/if}

    <div class="cache-clear">
      <h3>{$i18n.t.settings.cacheSettings.clearTitle}</h3>
      <p>{$i18n.t.settings.cacheSettings.clearDescription}</p>
      <Button variant="secondary" onclick={clearCache}>
        {$i18n.t.settings.cacheSettings.clearButton}
      </Button>
    </div>

    {#if cacheSettingMessage}
      <div class="result-message">
        {cacheSettingMessage}
      </div>
    {/if}
  </div>
</CardSection>

<style>
  p {
    margin-bottom: 15px;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  .cache-settings {
    margin-top: 15px;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 15px 0;
  }

  .radio-group label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .radio-group input[type="radio"] {
    margin-right: 10px;
  }

  .timeout-setting {
    margin-top: 15px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .timeout-setting input {
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background-color: var(--color-card);
    color: var(--color-text);
    max-width: 200px;
    transition:
      border-color 0.3s ease,
      background-color 0.3s ease,
      color 0.3s ease;
  }

  .cache-clear {
    margin-top: 20px;
  }

  .result-message {
    margin-top: 15px;
    padding: 10px;
    background-color: var(--color-success-bg);
    border: 1px solid var(--color-success-border);
    border-radius: 8px;
    font-weight: bold;
    color: var(--color-success);
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease,
      color 0.3s ease;
  }
</style>
