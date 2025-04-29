<script lang="ts">
import { onDestroy } from 'svelte';
import { i18n } from '../i18n/i18nStore.js';
import type { RelayInfo } from '../services/relay.service.js';
import { publicKey } from '../store/appState.js';
import { relayService } from '../store/relayStore.js';

// 状態変数
let publicKeyShort = $state('');
let npubAddress = $state('');
let relayStatuses = $state<{ [url: string]: RelayInfo }>({});

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
    npubAddress = `npub形式 (実装省略: ${publicKeyValue.slice(0, 6)}...)`;
  }
});
</script>

<div class="relay-container">
  <div class="pubkey-display">
    <h3>{$i18n.t.nostr.publicKey}</h3>
    <p>{publicKeyShort}</p>
    <p class="npub">{npubAddress}</p>
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
    background-color: #f5f5f5;
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }

  .pubkey-display {
    word-break: break-all;
    margin-bottom: 20px;
  }

  .npub {
    font-size: 0.9rem;
    color: #666;
  }

  .relay-status {
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
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
    border-bottom: 1px solid #eee;
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
    background-color: #28a745;
    color: white;
  }

  .status-connecting {
    background-color: #ffc107;
    color: black;
  }

  .status-closed,
  .status-error {
    background-color: #dc3545;
    color: white;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
  }
</style>
