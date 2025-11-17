<script lang="ts">
  import CopyIcon from "../../assets/copy-icon.svg";
  import { i18n } from "../../i18n/i18n-store.js";
  import { getNosskeyManager } from "../../services/nosskey-manager.service.js";
  import CardSection from "../ui/CardSection.svelte";
  import Button from "../ui/button/Button.svelte";
  import IconButton from "../ui/button/IconButton.svelte";

  // KeyInfoエクスポート関連の状態変数
  let showExportSection = $state(false);
  let isExporting = $state(false);
  let exportedKeyInfo = $state("");
  let exportError = $state("");
  let showCopiedMessage = $state(false);

  // NosskeyManagerのシングルトンインスタンスを取得
  const keyManager = getNosskeyManager();

  // エクスポートセクションの表示トグル
  function toggleExportKeySection() {
    showExportSection = !showExportSection;
    // セクションを隠す際は内容もクリア
    if (!showExportSection) {
      exportedKeyInfo = "";
      exportError = "";
    }
  }

  // 鍵情報をエクスポート
  async function exportKeyInfo() {
    // 鍵情報が存在するか確認
    const currentKeyInfo = keyManager.getCurrentKeyInfo();
    if (!currentKeyInfo) {
      exportError = $i18n.t.settings.exportKeyInfo.noCurrentKeyInfo;
      return;
    }

    isExporting = true;
    exportedKeyInfo = "";
    exportError = "";

    try {
      // 鍵情報をJSON文字列に変換
      exportedKeyInfo = JSON.stringify(exportKeyInfo, null, 2);
    } catch (error) {
      console.error("KeyInfoエクスポートエラー:", error);
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
        console.error("クリップボードコピーエラー:", err);
      });
  }

  // KeyInfoをファイルとして保存
  function saveKeyInfoToFile() {
    if (!exportedKeyInfo) return;

    const blob = new Blob([exportedKeyInfo], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "nosskey-key-info-backup.json";
    a.click();

    URL.revokeObjectURL(url);
  }
</script>

<CardSection title={$i18n.t.settings.exportKeyInfo.title}>
  <p class="info-text">
    {$i18n.t.settings.exportKeyInfo.description}
  </p>
  <p class="warning-text">
    {$i18n.t.settings.exportKeyInfo.warning}
  </p>

  <Button variant="warning" onclick={toggleExportKeySection}>
    {showExportSection
      ? $i18n.t.settings.exportKeyInfo.hideExportSection
      : $i18n.t.settings.exportKeyInfo.showExportSection}
  </Button>

  {#if showExportSection}
    <div class="export-section">
      <p class="warning-text">
        {$i18n.t.settings.exportKeyInfo.restoreWarning}
      </p>

      <Button onclick={exportKeyInfo} disabled={isExporting}>
        {isExporting
          ? $i18n.t.common.loading
          : $i18n.t.settings.exportKeyInfo.exportButton}
      </Button>

      {#if exportedKeyInfo}
        <div class="key-display">
          <p>{$i18n.t.settings.exportKeyInfo.backupData}</p>
          <div class="key-container">
            <textarea readonly value={exportedKeyInfo} class="key-info-textarea"
            ></textarea>
            <div class="action-buttons">
              <IconButton
                onclick={() => copyToClipboard(exportedKeyInfo)}
                title={$i18n.t.common.copy}
              >
                <img src={CopyIcon} alt="Copy" />
              </IconButton>
              <Button
                onclick={saveKeyInfoToFile}
                title={$i18n.t.settings.exportKeyInfo.saveFileTitle}
                size="small"
              >
                {$i18n.t.settings.exportKeyInfo.saveFile}
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

  .key-info-textarea {
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
