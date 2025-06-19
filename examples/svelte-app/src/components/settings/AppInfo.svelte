<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import SettingSection from './SettingSection.svelte';

const commitHash = import.meta.env.VITE_GIT_COMMIT_HASH || 'unknown';
</script>

<SettingSection title={$i18n.t.settings.appInfo.title}>
  <div class="info-item">
    <div class="label">{$i18n.t.settings.appInfo.version}</div>
    <div class="value">0.1.0</div>
  </div>
  <div class="info-item">
    <div class="label">{$i18n.t.settings.appInfo.buildDate}</div>
    <div class="value">2025/04/29</div>
  </div>
  <div class="info-item">
    <div class="label">{$i18n.t.settings.appInfo.commitHash}</div>
    <div class="value">{commitHash}</div>
  </div>
</SettingSection>

<style>
  .info-item {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border-light);
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .label {
    flex: 0 0 140px;
    font-weight: bold;
    color: var(--color-text-primary);
  }

  .value {
    flex: 1;
  }
</style>
