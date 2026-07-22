<script lang="ts">
import { changeTermMode, i18n } from '../../i18n/i18n-store.js';
import type { TermMode } from '../../i18n/translations.js';
import CardSection from '../ui/CardSection.svelte';
import SettingMessage from '../ui/SettingMessage.svelte';

// 状態変数
let termModeMessage = $state('');

// 用語表示モードを変更する関数
function updateTermMode(mode: TermMode) {
  changeTermMode(mode);
  termModeMessage = $i18n.t.settings.termMode.changed;
  setTimeout(() => {
    termModeMessage = '';
  }, 3000);
}
</script>

<CardSection title={$i18n.t.settings.termMode.title}>
  <div class="term-mode-selector">
    <p>{$i18n.t.settings.termMode.selectMode}</p>
    <div class="radio-group">
      <label>
        <input
          type="radio"
          name="term-mode"
          value="simple"
          checked={$i18n.termMode === "simple"}
          onclick={() => updateTermMode("simple")}
        />
        {$i18n.t.settings.termMode.simpleLabel}
      </label>
      <label>
        <input
          type="radio"
          name="term-mode"
          value="standard"
          checked={$i18n.termMode === "standard"}
          onclick={() => updateTermMode("standard")}
        />
        {$i18n.t.settings.termMode.standardLabel}
      </label>
    </div>

    <SettingMessage message={termModeMessage} />
  </div>
</CardSection>

<style>
  p {
    margin-bottom: 15px;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  .term-mode-selector {
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
</style>
