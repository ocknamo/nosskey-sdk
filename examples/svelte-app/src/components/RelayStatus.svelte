<script lang="ts">
import { onDestroy } from 'svelte';
import CopyIcon from '../assets/copy-icon.svg';
import { i18n } from '../i18n/i18n-store.js';
import type { RelayInfo } from '../services/relay.service.js';
import { publicKey } from '../store/app-state.js';
import { relayService } from '../store/relay-store.js';
import { hexToNpub } from '../utils/bech32-converter.js';
import IconButton from './ui/IconButton.svelte';

// 状態変数
let publicKeyShort = $state('');
let npubAddress = $state('');
let relayStatuses = $state<{ [url: string]: RelayInfo }>({});
let showCopiedMessage = $state(false);

// リレーサービスからの状態をサブスクライブ
const unsubscribeRelayStatus = relayService.relayStatuses.subscribe((value) => {
  relayStatuses = value;
});

// コンポーネント破棄時にサブスクリプションを解除
onDestroy(() => {
  unsubscribeRelayStatus();
});

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

<div class="relay-container">
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

  <div class="relay-status">
    <h3>{$i18n.t.nostr.relayStatus}</h3>
    <ul>
      {#each Object.entries(relayStatuses) as [url, status]}
        <li>
          <span class="relay-url">{url}</span>
          <span class="status-badge status-{status.status}">
            {status.status === "active"
              ? $i18n.t.nostr.relayStates.connected
              : status.status === "connecting"
                ? $i18n.t.nostr.relayStates.connecting
                : status.status === "closed"
                  ? $i18n.t.nostr.relayStates.disconnected
                  : $i18n.t.nostr.relayStates.unknown}
          </span>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .relay-container {
    background-color: var(--color-surface-alt);
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }

  .pubkey-display {
    word-break: break-all;
    margin-bottom: 20px;
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

  .relay-status {
    margin-top: 15px;
    padding: 10px;
    background-color: var(--color-surface);
    border-radius: 4px;
  }

  .relay-status ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .relay-status li {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    padding: 5px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .relay-url {
    font-family: monospace;
    word-break: break-all;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    margin-left: 10px;
    white-space: nowrap;
  }

  .status-active {
    background-color: var(--color-success);
    color: white;
  }

  .status-connecting {
    background-color: var(--color-warning);
    color: black;
  }

  .status-closed,
  .status-error {
    background-color: var(--color-error);
    color: white;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
  }
</style>
