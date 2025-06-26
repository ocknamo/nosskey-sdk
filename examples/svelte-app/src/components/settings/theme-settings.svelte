<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { type ThemeMode, currentTheme } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';

let selectedTheme: ThemeMode = 'auto';

// 現在の設定を読み込み
currentTheme.subscribe((value) => {
  selectedTheme = value;
});

const handleThemeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const newTheme = target.value as ThemeMode;
  selectedTheme = newTheme;
  currentTheme.set(newTheme);

  // テーマ変更のフィードバック
  const message = document.createElement('div');
  message.textContent = $i18n.t.settings.theme.changed;
  message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-primary);
      color: var(--color-text-on-primary);
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px var(--color-shadow-strong);
      animation: fadeInOut 3s ease-in-out;
    `;

  document.body.appendChild(message);
  setTimeout(() => {
    if (message.parentNode) {
      message.parentNode.removeChild(message);
    }
  }, 3000);
};
</script>

<CardSection title={$i18n.t.settings.theme.title}>
  <p class="description">{$i18n.t.settings.theme.description}</p>

  <div class="theme-selection">
    <label for="theme-select">{$i18n.t.settings.theme.title}:</label>
    <select
      id="theme-select"
      bind:value={selectedTheme}
      on:change={handleThemeChange}
      class="theme-select"
    >
      <option value="auto">{$i18n.t.settings.theme.auto}</option>
      <option value="light">{$i18n.t.settings.theme.light}</option>
      <option value="dark">{$i18n.t.settings.theme.dark}</option>
    </select>
  </div>
</CardSection>

<style>
  .description {
    margin-bottom: 20px;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .theme-selection {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .theme-selection label {
    font-weight: 500;
    color: var(--color-text);
    font-size: 14px;
  }

  .theme-select {
    padding: 12px 16px;
    border: 2px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-card);
    color: var(--color-text);
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .theme-select:hover {
    border-color: var(--color-primary);
  }

  .theme-select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
  }
</style>
