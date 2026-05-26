<script lang="ts">
import { isLoggedIn } from '../../store/app-state.js';
import ExportKeyInfoComponent from '../settings/ExportKeyInfoComponent.svelte';
import ExportSecretKey from '../settings/ExportSecretKey.svelte';
import ImportKeyInfo from '../settings/ImportKeyInfo.svelte';
import LocalStorageSection from '../settings/LocalStorageSection.svelte';
import LogoutSection from '../settings/LogoutSection.svelte';
import SecretCacheSettings from '../settings/SecretCacheSettings.svelte';
</script>

<div class="settings-container">
  {#if $isLoggedIn}
    <SecretCacheSettings />
    <ExportKeyInfoComponent />
    <ExportSecretKey />
    <LogoutSection />
    <LocalStorageSection />
  {:else}
    <ImportKeyInfo />
  {/if}
</div>

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }
</style>
