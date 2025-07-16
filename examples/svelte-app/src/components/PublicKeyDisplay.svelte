<script lang="ts">
import CopyIcon from '../assets/copy-icon.svg';
import { i18n } from '../i18n/i18n-store.js';
import { publicKey } from '../store/app-state.js';
import { hexToNpub } from '../utils/bech32-converter.js';
import IconButton from './ui/IconButton.svelte';

// 状態変数
let publicKeyShort = $state('');
let npubAddress = $state('');
let showCopiedMessage = $state(false);

// パブリックキーを取得
let publicKeyValue = '';
publicKey.subscribe((value) => {
  publicKeyValue = value || '';

  if (publicKeyValue) {
    // 公開鍵を表示用に整形
    publicKeyShort = `${publicKeyValue.slice(0, 8)}...${publicKeyValue.slice(-8)}`;

    // npub形式に変換
    try {
      npubAddress = hexToNpub(publicKeyValue);
    } catch (error) {
      console.error('npub変換エラー:', error);
      npubAddress = 'Error: Could not convert to npub';
    }
  }
});

// クリップボードにコピー
function copyNpubToClipboard() {
  if (npubAddress) {
    navigator.clipboard
      .writeText(npubAddress)
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
}
</script>

<div class="pubkey-container">
  <div class="pubkey-display">
    <h3>{$i18n.t.nostr.publicKey}</h3>
    <p>{publicKeyShort}</p>
    <div class="npub-container">
      <div class="npub-wrapper">
        <p class="npub">
          {npubAddress.length > 20
            ? `${npubAddress.slice(0, 12)}...${npubAddress.slice(-8)}`
            : npubAddress}
        </p>
        <IconButton
          onclick={copyNpubToClipboard}
          title={$i18n.t.nostr.copyToClipboard}
        >
          <img src={CopyIcon} alt="Copy" />
        </IconButton>
      </div>
      {#if showCopiedMessage}
        <span class="copied-message">{$i18n.t.nostr.copiedToClipboard}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .pubkey-container {
    background-color: var(--color-surface-alt);
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }

  .pubkey-display {
    word-break: break-all;
  }

  .npub-container {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 5px;
  }

  .npub-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .npub {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .copied-message {
    color: var(--color-success);
    font-size: 0.8rem;
    font-weight: bold;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
  }
</style>
