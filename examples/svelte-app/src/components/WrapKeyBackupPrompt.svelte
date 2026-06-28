<script lang="ts">
import type { NostrKeyInfo } from 'nosskey-sdk';
import { i18n } from '../i18n/i18n-store.js';
import { downloadTextFile } from '../utils/download-file.js';
import { serializeKeyInfoForExport } from '../utils/key-info-export.js';
import Button from './ui/button/Button.svelte';

const { keyInfo, onClose }: { keyInfo: NostrKeyInfo; onClose: () => void } = $props();

let downloaded = $state(false);

function saveBackup() {
  downloadTextFile(serializeKeyInfoForExport(keyInfo), 'nosskey-key-info-backup.json');
  downloaded = true;
}
</script>

<div
  class="backup-backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="wrap-backup-title"
>
  <div class="backup-card">
    <h2 id="wrap-backup-title">{$i18n.t.auth.wrapBackup.title}</h2>
    <p class="backup-desc">{$i18n.t.auth.wrapBackup.description}</p>
    <p class="backup-warning">{$i18n.t.auth.wrapBackup.warning}</p>

    <div class="backup-actions">
      <Button onclick={saveBackup} size="large">
        {downloaded
          ? $i18n.t.auth.wrapBackup.saveAgain
          : $i18n.t.auth.wrapBackup.saveButton}
      </Button>

      {#if downloaded}
        <p class="backup-saved">{$i18n.t.auth.wrapBackup.saved}</p>
      {/if}

      <button type="button" class="backup-skip" onclick={onClose}>
        {downloaded
          ? $i18n.t.auth.wrapBackup.continue
          : $i18n.t.auth.wrapBackup.later}
      </button>
    </div>
  </div>
</div>

<style>
  .backup-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 1000;
  }

  .backup-card {
    background: var(--color-card);
    color: var(--color-text);
    border: var(--border-width, 1px) solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 8px 24px var(--color-shadow-strong);
    padding: 24px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow: auto;
    text-align: center;
  }

  h2 {
    margin: 0 0 12px;
    color: var(--color-titles);
  }

  .backup-desc {
    margin: 0 0 12px;
    color: var(--color-text-secondary);
    line-height: 1.6;
    text-align: left;
  }

  .backup-warning {
    margin: 0 0 20px;
    color: var(--color-button-warning);
    line-height: 1.6;
    text-align: left;
  }

  .backup-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .backup-saved {
    margin: 0;
    color: var(--color-success);
    font-size: 0.9rem;
  }

  .backup-skip {
    background: none;
    border: none;
    padding: 4px;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    text-decoration: underline;
    cursor: pointer;
  }

  .backup-skip:hover {
    color: var(--color-text-primary);
  }
</style>
