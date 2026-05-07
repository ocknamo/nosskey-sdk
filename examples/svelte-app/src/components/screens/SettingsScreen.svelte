<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import AppInfo from '../settings/AppInfo.svelte';
import ConsentPolicySettings from '../settings/ConsentPolicySettings.svelte';
import LanguageSettings from '../settings/LanguageSettings.svelte';
import LocalStorageSection from '../settings/LocalStorageSection.svelte';
import RelaySettings from '../settings/RelaySettings.svelte';
import TrustedOriginsSettings from '../settings/TrustedOriginsSettings.svelte';
import ThemeSettings from '../settings/theme-settings.svelte';
</script>

<div class="settings-container">
  <h1 class="screen-title">{$i18n.t.settings.title}</h1>

  <LanguageSettings />
  <ThemeSettings />
  <RelaySettings />
  <ConsentPolicySettings />
  <TrustedOriginsSettings />
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
