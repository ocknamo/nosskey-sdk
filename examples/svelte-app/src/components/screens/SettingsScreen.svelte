<script lang="ts">
import AppInfo from '../settings/AppInfo.svelte';
import ConsentPolicySettings from '../settings/ConsentPolicySettings.svelte';
import LanguageSettings from '../settings/LanguageSettings.svelte';
import LocalStorageSection from '../settings/LocalStorageSection.svelte';
import RelaySettings from '../settings/RelaySettings.svelte';
import TrustedOriginsSettings from '../settings/TrustedOriginsSettings.svelte';
import ThemeSettings from '../settings/theme-settings.svelte';
</script>

<div class="settings-container">
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
</style>
