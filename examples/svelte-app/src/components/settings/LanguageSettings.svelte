<script lang="ts">
import { changeLanguage, i18n } from '../../i18n/i18n-store.js';
import CardSection from '../ui/CardSection.svelte';

// 状態変数
let languageMessage = $state('');

// 言語を変更する関数
function updateLanguage(lang: 'ja' | 'en') {
  changeLanguage(lang);
  languageMessage = $i18n.t.settings.language.changed;
  setTimeout(() => {
    languageMessage = '';
  }, 3000);
}
</script>

<CardSection title={$i18n.t.settings.language.title}>
  <div class="language-selector">
    <p>{$i18n.t.settings.language.selectLanguage}</p>
    <div class="radio-group">
      <label>
        <input
          type="radio"
          name="language"
          value="ja"
          checked={$i18n.currentLanguage === "ja"}
          onclick={() => updateLanguage("ja")}
        />
        {$i18n.t.settings.language.japaneseLabel}
      </label>
      <label>
        <input
          type="radio"
          name="language"
          value="en"
          checked={$i18n.currentLanguage === "en"}
          onclick={() => updateLanguage("en")}
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
</CardSection>

<style>
  p {
    margin-bottom: 15px;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
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

  .radio-group label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .radio-group input[type="radio"] {
    margin-right: 10px;
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
