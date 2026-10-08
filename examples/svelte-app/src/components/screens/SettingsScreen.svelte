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

<!-- PC は 2 カラム。左: リレー・信頼済みサイト・言語・テーマ / 右: 同意ポリシー・
     モード・アプリ情報・開発者向け。style:order はモバイル 1 列時の並び順で、
     従来の縦並び（リレー → 同意 → 信頼済み → 言語 → モード → テーマ → 情報 → 開発者）を保つ。
     モード切替でカードが増減しても TermModeSettings は同じ列に留まるため再マウントされない。 -->
<div class="settings-container screen-columns">
  <div class="screen-column">
    {#if $termMode === "standard"}
      <div style:order="1"><RelaySettings /></div>
    {/if}
    <div style:order="3"><TrustedOriginsSettings /></div>
    <div style:order="4"><LanguageSettings /></div>
    <div style:order="6"><ThemeSettings /></div>
  </div>
  <div class="screen-column">
    {#if $termMode === "standard"}
      <div style:order="2"><ConsentPolicySettings /></div>
    {/if}
    <div style:order="5"><TermModeSettings /></div>
    <div style:order="7"><AppInfo /></div>
    {#if $termMode === "standard"}
      <div style:order="8"><DeveloperSection /></div>
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
