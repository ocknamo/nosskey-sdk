<script lang="ts">
import { changeLanguage, i18n } from '../i18n/i18nStore.js';
import type { Language } from '../i18n/translations.js';
import { cacheSecrets, currentScreen, defaultRelays, resetState } from '../store/appState.js';
import { activeRelays } from '../store/relayStore.js';

// 状態変数
let clearResult = $state('');
let newRelay = $state('');
let relayMessage = $state('');
let relays = $state<string[]>([]);
const languageMessage = $state('');
let cacheSettingMessage = $state('');
let isCaching = $state(true);

// ストアを監視して更新
activeRelays.subscribe((value) => {
  relays = value;
});

cacheSecrets.subscribe((value) => {
  isCaching = value;
});

// リレーを追加する関数
function addRelay() {
  if (!newRelay) {
    relayMessage = $i18n.t.settings.relayManagement.messages.enterUrl;
    return;
  }

  // 簡易的なバリデーション
  if (!newRelay.startsWith('wss://')) {
    relayMessage = $i18n.t.settings.relayManagement.messages.startWithWss;
    return;
  }

  // すでに存在するかチェック
  if (relays.includes(newRelay)) {
    relayMessage = $i18n.t.settings.relayManagement.messages.alreadyExists;
    return;
  }

  // リレーを追加（activeRelaysストアを更新）
  activeRelays.update((currentRelays) => [...currentRelays, newRelay]);

  // 入力フィールドをクリア
  newRelay = '';
  relayMessage = $i18n.t.settings.relayManagement.messages.added;

  // 3秒後にメッセージをクリア
  setTimeout(() => {
    relayMessage = '';
  }, 3000);
}

// リレーを削除する関数
function removeRelay(relay: string) {
  // activeRelaysストアを更新
  activeRelays.update((currentRelays) => currentRelays.filter((r) => r !== relay));

  relayMessage = $i18n.t.settings.relayManagement.messages.deleted;

  // 3秒後にメッセージをクリア
  setTimeout(() => {
    relayMessage = '';
  }, 3000);
}

// リレーをデフォルトにリセットする関数
function resetRelays() {
  // デフォルト値にリセット
  activeRelays.set([...defaultRelays]);

  relayMessage = $i18n.t.settings.relayManagement.messages.reset;

  // 3秒後にメッセージをクリア
  setTimeout(() => {
    relayMessage = '';
  }, 3000);
}

// キャッシュ設定を更新する関数
function updateCacheSetting(value: boolean) {
  cacheSecrets.set(value);
  cacheSettingMessage = $i18n.t.settings.cacheSettings.saved;
  setTimeout(() => {
    cacheSettingMessage = '';
  }, 3000);
}

// ローカルストレージをクリアする関数
function clearLocalStorage() {
  try {
    // 保存されたキーを削除
    localStorage.removeItem('nosskey_credential_ids');
    localStorage.removeItem('nosskey_pwk_blob');

    // メッセージを表示
    clearResult = $i18n.t.settings.localStorage.cleared;

    // アプリケーションの状態をリセット
    resetState();

    // 3秒後にメッセージをクリア
    setTimeout(() => {
      clearResult = '';
      // 認証画面に戻る
      currentScreen.set('auth');
    }, 3000);
  } catch (error) {
    clearResult = `エラー: ${error instanceof Error ? error.message : String(error)}`;
  }
}
</script>

<div class="settings-container">
  <h1>{$i18n.t.settings.title}</h1>

  <div class="settings-section">
    <h2>{$i18n.t.settings.relayManagement.title}</h2>
    <p>{$i18n.t.settings.relayManagement.description}</p>

    <div class="relay-list">
      <h3>{$i18n.t.settings.relayManagement.currentRelays}</h3>
      {#if relays.length === 0}
        <p class="empty-message">{$i18n.t.settings.relayManagement.noRelays}</p>
      {:else}
        <ul>
          {#each relays as relay}
            <li>
              <span class="relay-url">{relay}</span>
              <button class="remove-button" onclick={() => removeRelay(relay)}
                >{$i18n.t.settings.relayManagement.delete}</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="add-relay">
      <h3>{$i18n.t.settings.relayManagement.addRelay}</h3>
      <div class="input-group">
        <input type="text" placeholder="wss://" bind:value={newRelay} />
        <button onclick={addRelay}
          >{$i18n.t.settings.relayManagement.add}</button
        >
      </div>
      <button class="secondary-button" onclick={resetRelays}
        >{$i18n.t.settings.relayManagement.reset}</button
      >

      {#if relayMessage}
        <div class="result-message">
          {relayMessage}
        </div>
      {/if}
    </div>
  </div>

  <div class="settings-section">
    <h2>{$i18n.t.settings.cacheSettings.title}</h2>
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

      {#if cacheSettingMessage}
        <div class="result-message">
          {cacheSettingMessage}
        </div>
      {/if}
    </div>
  </div>

  <div class="settings-section">
    <h2>{$i18n.t.settings.localStorage.title}</h2>
    <p>
      {$i18n.t.settings.localStorage.description}
    </p>

    <button class="danger-button" onclick={clearLocalStorage}>
      {$i18n.t.settings.localStorage.clear}
    </button>

    {#if clearResult}
      <div class="result-message">
        {clearResult}
      </div>
    {/if}
  </div>

  <div class="settings-section">
    <h2>{$i18n.t.settings.language.title}</h2>
    <div class="language-selector">
      <p>{$i18n.t.settings.language.selectLanguage}</p>
      <div class="radio-group">
        <label>
          <input
            type="radio"
            name="language"
            value="ja"
            checked={$i18n.currentLanguage === "ja"}
            onclick={() => {
              changeLanguage("ja");
              languageMessage = $i18n.t.settings.language.changed;
              setTimeout(() => {
                languageMessage = "";
              }, 3000);
            }}
          />
          {$i18n.t.settings.language.japaneseLabel}
        </label>
        <label>
          <input
            type="radio"
            name="language"
            value="en"
            checked={$i18n.currentLanguage === "en"}
            onclick={() => {
              changeLanguage("en");
              languageMessage = $i18n.t.settings.language.changed;
              setTimeout(() => {
                languageMessage = "";
              }, 3000);
            }}
          />
          {$i18n.t.settings.language.englishLabel}
        </label>
      </div>

      {#if languageMessage}
        <div class="result-message">
          {languageMessage}
        </div>
      {/if}
    </div>
  </div>

  <div class="settings-section">
    <h2>{$i18n.t.settings.appInfo.title}</h2>
    <div class="info-item">
      <div class="label">{$i18n.t.settings.appInfo.version}</div>
      <div class="value">0.1.0</div>
    </div>
    <div class="info-item">
      <div class="label">{$i18n.t.settings.appInfo.buildDate}</div>
      <div class="value">2025/04/29</div>
    </div>
  </div>
</div>

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }

  .language-selector {
    margin-top: 15px;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 15px 0;
  }

  .cache-settings {
    margin-top: 15px;
  }

  .radio-group label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .radio-group input[type="radio"] {
    margin-right: 10px;
  }

  h1,
  h2 {
    margin-bottom: 15px;
  }

  .settings-section {
    background-color: #ffffff;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
  }

  .relay-list {
    margin-bottom: 20px;
  }

  .relay-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .relay-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    margin-bottom: 5px;
    background-color: #f8f9fa;
    border-radius: 4px;
  }

  .relay-url {
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 10px;
  }

  .remove-button {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .empty-message {
    color: #999;
    font-style: italic;
  }

  .input-group {
    display: flex;
    margin-bottom: 10px;
  }

  .input-group input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px 0 0 4px;
    font-size: 1rem;
  }

  .input-group button {
    background-color: #5755d9;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
  }

  .secondary-button {
    background-color: #6c757d;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    margin-top: 10px;
  }

  p {
    margin-bottom: 15px;
    color: #666;
  }

  .danger-button {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 10px;
  }

  .danger-button:hover {
    background-color: #c82333;
  }

  .result-message {
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
    font-weight: bold;
  }

  .info-item {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .label {
    flex: 0 0 120px;
    font-weight: bold;
    color: #555;
  }

  .value {
    flex: 1;
  }
</style>
