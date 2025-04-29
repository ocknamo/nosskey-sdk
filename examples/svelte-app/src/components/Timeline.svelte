<script lang="ts">
import type { Subscription } from 'rxjs';
import { onDestroy } from 'svelte';
import type { NostrEvent } from '../../../../src/types.js';
import { i18n } from '../i18n/i18nStore.js';
import { publicKey } from '../store/appState.js';
import { relayService } from '../store/relayStore.js';

// 状態変数
let events = $state<NostrEvent[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let currentPublicKey = $state<string | null>(null);

// サブスクリプション管理
let timelineSubscription: Subscription | undefined = undefined;

// publicKeyストアを監視
$effect(() => {
  currentPublicKey = $publicKey;
  if (currentPublicKey) {
    loadTimeline();
  }
});

// relayServiceのtimelineEventsストアを監視
const unsubscribe = relayService.timelineEvents.subscribe((value) => {
  events = value;
  loading = false;
});

// タイムラインデータの読み込み
function loadTimeline() {
  if (!currentPublicKey) {
    error = '公開鍵が設定されていません';
    loading = false;
    return;
  }

  // 前回のサブスクリプションがあれば解除
  if (timelineSubscription) {
    timelineSubscription.unsubscribe();
  }

  // 初期化
  loading = true;
  error = null;
  events = [];

  try {
    // タイムラインを取得
    timelineSubscription = relayService.fetchTimeline(currentPublicKey, {
      limit: 50,
    });
  } catch (err) {
    error = `タイムラインの取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
    loading = false;
  }
}

// コンポーネント破棄時にサブスクリプションを解除
onDestroy(() => {
  unsubscribe();

  if (timelineSubscription) {
    timelineSubscription.unsubscribe();
  }
});

// 日付のフォーマット
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// 再読み込み処理
function reloadTimeline() {
  loadTimeline();
}
</script>

<div class="timeline-container">
  <div class="timeline-header">
    <h2>{$i18n.t.nostr.timeline.title}</h2>
    <button class="reload-button" onclick={reloadTimeline} disabled={loading}>
      {loading ? $i18n.t.nostr.timeline.loading : $i18n.t.nostr.timeline.reload}
    </button>
  </div>

  {#if loading}
    <div class="loading-indicator">
      <p>{$i18n.t.nostr.timeline.loading}</p>
    </div>
  {:else if error}
    <div class="error-message">
      <p>{error}</p>
      <button onclick={reloadTimeline}>{$i18n.t.nostr.timeline.retry}</button>
    </div>
  {:else if events.length === 0}
    <div class="empty-timeline">
      <p>{$i18n.t.nostr.timeline.empty}</p>
    </div>
  {:else}
    <div class="events-list">
      {#each events as event}
        <div class="event-card">
          <div class="event-header">
            <span class="event-date">{formatDate(event.created_at || 0)}</span>
            <span class="event-id">{(event.id || "").substring(0, 10)}...</span>
          </div>
          <div class="event-content">
            <p>{event.content || ""}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .timeline-container {
    margin-top: 20px;
    background-color: #ffffff;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 15px;
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
  }

  .timeline-header h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .reload-button {
    background-color: #5755d9;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .reload-button:disabled {
    background-color: #cccccc;
  }

  .loading-indicator {
    text-align: center;
    padding: 20px;
    color: #666;
  }

  .error-message {
    background-color: #ffdddd;
    padding: 15px;
    border-radius: 4px;
    color: #ff0000;
    margin-bottom: 15px;
  }

  .error-message button {
    background-color: #5755d9;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    margin-top: 10px;
    cursor: pointer;
  }

  .empty-timeline {
    text-align: center;
    padding: 30px;
    color: #666;
    font-style: italic;
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .event-card {
    border: 1px solid #eee;
    border-radius: 5px;
    padding: 15px;
    background-color: #f9f9f9;
  }

  .event-header {
    display: flex;
    justify-content: space-between;
    color: #666;
    font-size: 0.85rem;
    margin-bottom: 10px;
  }

  .event-content {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .event-content p {
    margin: 0;
    line-height: 1.5;
  }
</style>
