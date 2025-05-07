<script lang="ts">
import CopyIcon from '../../assets/copy-icon.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getPWKManager } from '../../services/pwk-manager.service.js';
import { hexToNsec } from '../../utils/bech32-converter.js';
import SettingSection from './SettingSection.svelte';

// 秘密鍵エクスポート関連の状態変数
let showExportSection = $state(false);
let isExporting = $state(false);
let exportedNsec = $state('');
let exportError = $state('');
let showCopiedMessage = $state(false);

// PWKManagerのシングルトンインスタンスを取得
const pwkManager = getPWKManager();

// エクスポートセクションの表示トグル
function toggleExportKeySection() {
  showExportSection = !showExportSection;
  // セクションを隠す際は内容もクリア
  if (!showExportSection) {
    exportedNsec = '';
    exportError = '';
  }
}

// 秘密鍵をエクスポート
async function exportSecretKey() {
  // PWKが存在するか確認
  const currentPWK = pwkManager.getCurrentPWK();
  if (!currentPWK) {
    exportError = $i18n.t.settings.noKeyToExport;
    return;
  }

  isExporting = true;
  exportedNsec = '';
  exportError = '';

  try {
    // PWKManagerのexportNostrKey関数を使用して秘密鍵を取得
    const hexPrivkey = await pwkManager.exportNostrKey(currentPWK);

    // 16進数からnsec形式に変換
    exportedNsec = hexToNsec(hexPrivkey);
  } catch (error) {
    console.error('秘密鍵エクスポートエラー:', error);
    exportError = `エクスポートエラー: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isExporting = false;
  }
}

// クリップボードにコピー
function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showCopiedMessage = true;
      setTimeout(() => {
        showCopiedMessage = false;
      }, 2000);
    })
    .catch((err) => {
      console.error('クリップボードコピーエラー:', err);
    });
}
</script>

<SettingSection title={$i18n.t.settings.exportSecretKey}>
  <p class="warning-text">{$i18n.t.settings.exportSecretKeyWarning}</p>

  <button class="action-button export-button" onclick={toggleExportKeySection}>
    {showExportSection
      ? $i18n.t.settings.hideExportSection
      : $i18n.t.settings.showExportSection}
  </button>

  {#if showExportSection}
    <div class="export-section">
      <p class="warning-text strong">{$i18n.t.settings.exportWarningFinal}</p>

      <button
        class="action-button danger-button"
        onclick={exportSecretKey}
        disabled={isExporting}
      >
        {isExporting ? $i18n.t.common.loading : $i18n.t.settings.confirmExport}
      </button>

      {#if exportedNsec}
        <div class="key-display">
          <p>{$i18n.t.settings.yourSecretKey}</p>
          <div class="key-container">
            <input
              type="text"
              readonly
              value={exportedNsec}
              class="key-input"
            />
            <button
              class="icon-button"
              onclick={() => copyToClipboard(exportedNsec)}
              title={$i18n.t.common.copy}
            >
              <img src={CopyIcon} alt="Copy" />
            </button>
          </div>
          {#if showCopiedMessage}
            <p class="copied-message">{$i18n.t.common.copied}</p>
          {/if}
        </div>
      {/if}

      {#if exportError}
        <p class="error-message">{exportError}</p>
      {/if}
    </div>
  {/if}
</SettingSection>

<style>
  p {
    margin-bottom: 15px;
    color: #666;
  }

  .warning-text {
    color: #dc3545;
    font-weight: normal;
  }

  .warning-text.strong {
    font-weight: bold;
  }

  .action-button {
    background-color: #5755d9;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    margin-top: 10px;
  }

  .export-button {
    background-color: #ffc107;
    color: #333;
  }

  .danger-button {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 10px;
  }

  .danger-button:disabled {
    background-color: #e9acb1;
    cursor: not-allowed;
  }

  .export-section {
    margin-top: 15px;
    padding: 15px;
    border: 1px solid #f8d7da;
    border-radius: 4px;
    background-color: #fff5f5;
  }

  .key-display {
    margin-top: 15px;
  }

  .key-container {
    display: flex;
    align-items: center;
    margin-top: 8px;
    gap: 8px;
  }

  .key-input {
    flex: 1;
    padding: 8px;
    font-family: monospace;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .icon-button:hover {
    background-color: #eee;
  }

  .copied-message {
    color: #28a745;
    font-size: 0.8rem;
    margin-top: 4px;
  }

  .error-message {
    color: #dc3545;
    font-size: 0.9rem;
    margin-top: 10px;
  }
</style>
