<script lang="ts">
import { i18n } from '../i18n/i18n-store.js';
import AppInfo from './settings/AppInfo.svelte';
import ExportSecretKey from './settings/ExportSecretKey.svelte';
import LanguageSettings from './settings/LanguageSettings.svelte';
import LocalStorageSection from './settings/LocalStorageSection.svelte';
import LogoutSection from './settings/LogoutSection.svelte';
import RelayManagement from './settings/RelayManagement.svelte';
import SecretCacheSettings from './settings/SecretCacheSettings.svelte';
</script>

<div class="settings-container">
  <h1>{$i18n.t.settings.title}</h1>

  <RelayManagement />
  <SecretCacheSettings />
  <LanguageSettings />
  <LogoutSection />
  <LocalStorageSection />
  <ExportSecretKey />
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
