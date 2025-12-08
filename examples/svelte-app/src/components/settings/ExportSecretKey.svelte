<script lang="ts">
import CopyIcon from '../../assets/copy-icon.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import { hexToNsec } from '../../utils/bech32-converter.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';
import IconButton from '../ui/button/IconButton.svelte';

// 秘密鍵エクスポート関連の状態変数
let showExportSection = $state(false);
let isExporting = $state(false);
let exportedNsec = $state('');
let exportError = $state('');
let showCopiedMessage = $state(false);

// NosskeyManagerのシングルトンインスタンスを取得
const keyManager = getNosskeyManager();

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
  const currentPWK = keyManager.getCurrentKeyInfo();
  if (!currentPWK) {
    exportError = $i18n.t.settings.noKeyToExport;
    return;
  }

  isExporting = true;
  exportedNsec = '';
  exportError = '';

  try {
    // PWKManagerのexportNostrKey関数を使用して秘密鍵を取得
    const hexPrivkey = await keyManager.exportNostrKey(currentPWK);

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

<CardSection title={$i18n.t.settings.exportSecretKey}>
  <p class="warning-text">{$i18n.t.settings.exportSecretKeyWarning}</p>

  <Button variant="warning" onclick={toggleExportKeySection}>
    {showExportSection
      ? $i18n.t.settings.hideExportSection
      : $i18n.t.settings.showExportSection}
  </Button>

  {#if showExportSection}
    <div class="export-section">
      <p class="warning-text strong">{$i18n.t.settings.exportWarningFinal}</p>

      <Button variant="danger" onclick={exportSecretKey} disabled={isExporting}>
        {isExporting ? $i18n.t.common.loading : $i18n.t.settings.confirmExport}
      </Button>

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
            <IconButton
              onclick={() => copyToClipboard(exportedNsec)}
              title={$i18n.t.common.copy}
            >
              <img src={CopyIcon} alt="Copy" />
            </IconButton>
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

  .warning-text {
    color: var(--color-error);
    font-weight: normal;
  }

  .warning-text.strong {
    font-weight: bold;
  }

  .export-section {
    margin-top: 15px;
    padding: 15px;
    border: 1px solid var(--color-error-border);
    border-radius: 4px;
    background-color: var(--color-card) 5f5;
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
    border: 1px solid var(--color-border-medium);
    border-radius: 4px;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
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
