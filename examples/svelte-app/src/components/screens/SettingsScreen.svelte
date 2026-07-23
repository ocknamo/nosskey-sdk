<script lang="ts">
import { termMode } from '../../i18n/i18n-store.js';
import AppInfo from '../settings/AppInfo.svelte';
import ConsentPolicySettings from '../settings/ConsentPolicySettings.svelte';
import DeveloperSection from '../settings/DeveloperSection.svelte';
import LanguageSettings from '../settings/LanguageSettings.svelte';
import RelaySettings from '../settings/RelaySettings.svelte';
import TermModeSettings from '../settings/TermModeSettings.svelte';
import TrustedOriginsSettings from '../settings/TrustedOriginsSettings.svelte';
import ThemeSettings from '../settings/theme-settings.svelte';
</script>

<div class="settings-container">
  {#if $termMode === "standard"}
    <RelaySettings />
    <ConsentPolicySettings />
  {/if}
  <TrustedOriginsSettings />
  <LanguageSettings />
  <TermModeSettings />
  <ThemeSettings />
  <AppInfo />
  {#if $termMode === "standard"}
    <DeveloperSection />
  {/if}
</div>

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }
</style>
