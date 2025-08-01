<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import ExportPWKComponent from '../settings/ExportPWKComponent.svelte';
import ExportSecretKey from '../settings/ExportSecretKey.svelte';
import LocalStorageSection from '../settings/LocalStorageSection.svelte';
import LogoutSection from '../settings/LogoutSection.svelte';
import RelayManagement from '../settings/RelayManagement.svelte';
import SecretCacheSettings from '../settings/SecretCacheSettings.svelte';
</script>

<div class="settings-container">
  <h1 class="screen-title">{$i18n.t.key.title}</h1>

  <SecretCacheSettings />
  <ExportPWKComponent />
  <ExportSecretKey />
  <RelayManagement />
  <LogoutSection />
  <LocalStorageSection />
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
