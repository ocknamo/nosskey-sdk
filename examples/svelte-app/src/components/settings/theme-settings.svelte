<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { type ThemeMode, currentTheme } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import SettingMessage from '../ui/SettingMessage.svelte';

let selectedTheme = $state<ThemeMode>('auto');
let themeMessage = $state('');

// 現在の設定を読み込み
currentTheme.subscribe((value) => {
  selectedTheme = value;
});

const handleThemeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const newTheme = target.value as ThemeMode;
  selectedTheme = newTheme;
  currentTheme.set(newTheme);

  themeMessage = $i18n.t.settings.theme.changed;
  setTimeout(() => {
    themeMessage = '';
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
      onchange={handleThemeChange}
      class="theme-select"
    >
      <option value="purple-dark">{$i18n.t.settings.theme.purpleDark}</option>
      <option value="purple-light">{$i18n.t.settings.theme.purpleLight}</option>
      <option value="neutral-dark">{$i18n.t.settings.theme.neutralDark}</option>
      <option value="neutral-light">{$i18n.t.settings.theme.neutralLight}</option>
      <option value="auto">{$i18n.t.settings.theme.auto}</option>
    </select>
  </div>

  <SettingMessage message={themeMessage} />
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
