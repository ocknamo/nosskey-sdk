<script lang="ts">
import { termMode } from '../../i18n/i18n-store.js';
import { isLoggedIn } from '../../store/app-state.js';
import ExportKeyInfoComponent from '../settings/ExportKeyInfoComponent.svelte';
import ExportSecretKey from '../settings/ExportSecretKey.svelte';
import ImportKeyInfo from '../settings/ImportKeyInfo.svelte';
import LocalStorageSection from '../settings/LocalStorageSection.svelte';
import LogoutSection from '../settings/LogoutSection.svelte';
import SecretCacheSettings from '../settings/SecretCacheSettings.svelte';
</script>

<!-- ログイン中は PC で 2 カラム。左: キャッシュ設定・鍵情報バックアップ / 右: 秘密鍵
     エクスポート・ログアウト・ストレージ消去。モバイルでは DOM 順に 1 列で並ぶ。 -->
{#if $isLoggedIn}
  <div class="settings-container screen-columns">
    <div class="screen-column">
      {#if $termMode === "standard"}
        <SecretCacheSettings />
      {/if}
      <ExportKeyInfoComponent />
    </div>
    <div class="screen-column">
      <ExportSecretKey />
      <LogoutSection />
      {#if $termMode === "standard"}
        <LocalStorageSection />
      {/if}
    </div>
  </div>
{:else}
  <div class="settings-container single">
    <ImportKeyInfo />
  </div>
{/if}

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }

  @media (min-width: 960px) {
    .settings-container {
      max-width: 1120px;
      padding: 8px 24px 24px;
    }

    /* カード 1 枚だけの画面は 2 カラムにせず、読みやすい幅で中央に置く。 */
    .settings-container.single {
      max-width: 640px;
    }
  }
</style>
