<script lang="ts">
import CopyIcon from '../../assets/copy-icon.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getPWKManager } from '../../services/pwk-manager.service.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';
import IconButton from '../ui/button/IconButton.svelte';

// PWKエクスポート関連の状態変数
let showExportSection = $state(false);
let isExporting = $state(false);
let exportedPWK = $state('');
let exportError = $state('');
let showCopiedMessage = $state(false);

// PWKManagerのシングルトンインスタンスを取得
const pwkManager = getPWKManager();

// エクスポートセクションの表示トグル
function toggleExportKeySection() {
  showExportSection = !showExportSection;
  // セクションを隠す際は内容もクリア
  if (!showExportSection) {
    exportedPWK = '';
    exportError = '';
  }
}

// PWKをエクスポート
async function exportPWK() {
  // PWKが存在するか確認
  const currentPWK = pwkManager.getCurrentPWK();
  if (!currentPWK) {
    exportError = $i18n.t.settings.exportPWK.noCurrentPWK;
    return;
  }

  isExporting = true;
  exportedPWK = '';
  exportError = '';

  try {
    // PWKをJSON文字列に変換
    exportedPWK = JSON.stringify(currentPWK, null, 2);
  } catch (error) {
    console.error('PWKエクスポートエラー:', error);
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

// PWKをファイルとして保存
function savePWKToFile() {
  if (!exportedPWK) return;

  const blob = new Blob([exportedPWK], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = 'nosskey-pwk-backup.json';
  a.click();

  URL.revokeObjectURL(url);
}
</script>

<CardSection title={$i18n.t.settings.exportPWK.title}>
  <p class="info-text">
    {$i18n.t.settings.exportPWK.description}
  </p>
  <p class="warning-text">
    {$i18n.t.settings.exportPWK.warning}
  </p>

  <Button variant="warning" onclick={toggleExportKeySection}>
    {showExportSection
      ? $i18n.t.settings.exportPWK.hideExportSection
      : $i18n.t.settings.exportPWK.showExportSection}
  </Button>

  {#if showExportSection}
    <div class="export-section">
      <p class="warning-text">
        {$i18n.t.settings.exportPWK.restoreWarning}
      </p>

      <Button onclick={exportPWK} disabled={isExporting}>
        {isExporting
          ? $i18n.t.common.loading
          : $i18n.t.settings.exportPWK.exportButton}
      </Button>

      {#if exportedPWK}
        <div class="key-display">
          <p>{$i18n.t.settings.exportPWK.backupData}</p>
          <div class="key-container">
            <textarea readonly value={exportedPWK} class="pwk-textarea"
            ></textarea>
            <div class="action-buttons">
              <IconButton
                onclick={() => copyToClipboard(exportedPWK)}
                title={$i18n.t.common.copy}
              >
                <img src={CopyIcon} alt="Copy" />
              </IconButton>
              <Button
                onclick={savePWKToFile}
                title={$i18n.t.settings.exportPWK.saveFileTitle}
                size="small"
              >
                {$i18n.t.settings.exportPWK.saveFile}
              </Button>
            </div>
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
</CardSection>

<style>
  p {
    margin-bottom: 15px;
    color: var(--color-text-muted);
  }

  .info-text {
    color: var(--color-info);
    font-weight: normal;
  }

  .warning-text {
    color: var(--color-button-warning);
    font-weight: normal;
  }

  .export-section {
    margin-top: 15px;
    padding: 15px;
    border: 1px solid var(--color-info-bg);
    border-radius: 4px;
    background-color: var(--color-info-bg);
  }

  .key-display {
    margin-top: 15px;
  }

  .key-container {
    display: flex;
    flex-direction: column;
    margin-top: 8px;
    gap: 8px;
  }

  .pwk-textarea {
    width: 100%;
    height: 120px;
    padding: 8px;
    font-family: monospace;
    border: 1px solid var(--color-border-medium);
    border-radius: 4px;
    font-size: 0.9rem;
    resize: vertical;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .copied-message {
    color: var(--color-success);
    font-size: 0.8rem;
    margin-top: 4px;
  }

  .error-message {
    color: var(--color-error);
    font-size: 0.9rem;
    margin-top: 10px;
  }
</style>
