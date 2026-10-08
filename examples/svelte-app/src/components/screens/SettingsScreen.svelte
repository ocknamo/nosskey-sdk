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

<!-- PC は 2 カラム。モバイルでは左列 → 右列の DOM 順がそのまま 1 列の並びになる
     （standard: リレー → 同意 → 信頼済み → 言語 → モード → テーマ → 情報 → 開発者 /
       simple: 信頼済み → 言語 → モード → テーマ → 情報）。
     言語設定だけはモードで列を変えて左右の高さを揃える。モード切替を操作する
     TermModeSettings はどちらのモードでも右列に留まるため再マウントされない。 -->
<div class="settings-container screen-columns">
  <div class="screen-column">
    {#if $termMode === "standard"}
      <RelaySettings />
      <ConsentPolicySettings />
    {/if}
    <TrustedOriginsSettings />
    {#if $termMode !== "standard"}
      <LanguageSettings />
    {/if}
  </div>
  <div class="screen-column">
    {#if $termMode === "standard"}
      <LanguageSettings />
    {/if}
    <TermModeSettings />
    <ThemeSettings />
    <AppInfo />
    {#if $termMode === "standard"}
      <DeveloperSection />
    {/if}
  </div>
</div>

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
  }
</style>
