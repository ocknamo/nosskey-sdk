<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import AppInfo from '../settings/AppInfo.svelte';
import LanguageSettings from '../settings/LanguageSettings.svelte';
import LocalStorageSection from '../settings/LocalStorageSection.svelte';
import ThemeSettings from '../settings/theme-settings.svelte';
</script>

<div class="settings-container">
  <h1 class="screen-title">{$i18n.t.settings.title}</h1>

  <LanguageSettings />
  <ThemeSettings />
  <AppInfo />
</div>

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }

  h1 {
    margin-bottom: 20px;
  }
</style>
