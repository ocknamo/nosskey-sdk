<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import SettingSection from './SettingSection.svelte';
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
</SettingSection>

<style>
  .info-item {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .label {
    flex: 0 0 120px;
    font-weight: bold;
    color: #555;
  }

  .value {
    flex: 1;
  }
</style>
