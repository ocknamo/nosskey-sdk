<script lang="ts">
import ExportKeyInfoComponent from '../settings/ExportKeyInfoComponent.svelte';
import ExportSecretKey from '../settings/ExportSecretKey.svelte';
import LocalStorageSection from '../settings/LocalStorageSection.svelte';
import LogoutSection from '../settings/LogoutSection.svelte';
import SecretCacheSettings from '../settings/SecretCacheSettings.svelte';
</script>

<div class="settings-container">
  <SecretCacheSettings />
  <ExportKeyInfoComponent />
  <ExportSecretKey />
  <LogoutSection />
  <LocalStorageSection />
</div>

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }
</style>
