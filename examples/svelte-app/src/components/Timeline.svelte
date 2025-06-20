<script lang="ts">
import type { Subscription } from 'rxjs';
import { onDestroy, onMount } from 'svelte';
import type { NostrEvent } from '../../../../src/types.js';
import { i18n } from '../i18n/i18n-store.js';
import { publicKey } from '../store/app-state.js';
import { relayService } from '../store/relay-store.js';
import { timelineMode } from '../store/timeline-store.js';
import Button from './ui/Button.svelte';

// 状態変数
let events = $state<NostrEvent[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let currentPublicKey = $state<string | null>(null);
let currentMode = $state<'global' | 'user'>('global');

// サブスクリプション管理
let timelineSubscription: Subscription | undefined = undefined;

// ストアを監視
$effect(() => {
  currentPublicKey = $publicKey;
  currentMode = $timelineMode;

  // データの再読み込み
  if ((currentMode === 'user' && currentPublicKey) || currentMode === 'global') {
    loadTimeline();
  }
});

// relayServiceのtimelineEventsストアを監視
const unsubscribe = relayService.timelineEvents.subscribe((value) => {
  events = value;
  loading = false;
});

// タイムラインデータの読み込み
async function loadTimeline() {
  // ユーザーモードの場合は公開鍵が必要
  if (currentMode === 'user' && !currentPublicKey) {
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

  try {
    // モードに応じたタイムラインを取得
    timelineSubscription = await relayService.fetchTimelineByMode(currentMode, currentPublicKey, {
      limit: 50,
      forceRefresh: false,
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

// 初期データ読み込み
onMount(() => {
  loadTimeline();
});

// 日付のフォーマット
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// 強制再読み込み処理
async function reloadTimeline() {
  // 前回のサブスクリプションがあれば解除
  if (timelineSubscription) {
    timelineSubscription.unsubscribe();
  }

  // 初期化
  loading = true;
  error = null;

  try {
    // モードに応じたタイムラインを取得（強制更新）
    timelineSubscription = await relayService.fetchTimelineByMode(currentMode, currentPublicKey, {
      limit: 50,
      forceRefresh: true,
    });
  } catch (err) {
    error = `タイムラインの取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
    loading = false;
  }
}

// 再読込処理
export async function syncTimeline() {
  // 前回のサブスクリプションがあれば解除;
  if (timelineSubscription) {
    timelineSubscription.unsubscribe();
  }

  // 初期化
  error = null;

  try {
    // モードに応じたタイムラインを取得（強制更新）
    timelineSubscription = await relayService.fetchTimelineByMode(currentMode, currentPublicKey, {
      limit: 50,
      forceRefresh: false,
    });
  } catch (err) {
    error = `タイムラインの取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
  }
}
</script>

<div class="timeline-container">
  <div class="timeline-header">
    <h2>{$i18n.t.nostr.timeline.title}</h2>
    <Button onclick={reloadTimeline} disabled={loading} size="small">
      {loading ? $i18n.t.nostr.timeline.loading : $i18n.t.nostr.timeline.reload}
    </Button>
  </div>

  {#if loading}
    <div class="loading-indicator">
      <p>{$i18n.t.nostr.timeline.loading}</p>
    </div>
  {:else if error}
    <div class="error-message">
      <p>{error}</p>
      <Button onclick={reloadTimeline} size="small"
        >{$i18n.t.nostr.timeline.retry}</Button
      >
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
    background-color: var(--color-card);
    border-radius: 12px;
    border: 1px solid var(--color-border);
    box-shadow: 0 2px 4px var(--color-shadow);
    padding: 15px;
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-border);
    transition: border-color 0.3s ease;
  }

  .timeline-header h2 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--color-titles);
    transition: color 0.3s ease;
  }

  .loading-indicator {
    text-align: center;
    padding: 20px;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  .error-message {
    background-color: var(--color-tertiary);
    padding: 15px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    color: var(--color-text);
    margin-bottom: 15px;
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease,
      color 0.3s ease;
  }

  .empty-timeline {
    text-align: center;
    padding: 30px;
    color: var(--color-text-secondary);
    font-style: italic;
    transition: color 0.3s ease;
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .event-card {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 15px;
    background-color: var(--color-background);
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  .event-header {
    display: flex;
    justify-content: space-between;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    margin-bottom: 10px;
    transition: color 0.3s ease;
  }

  .event-content {
    white-space: pre-wrap;
    word-break: break-word;
    text-align: left;
    color: var(--color-text);
    transition: color 0.3s ease;
  }

  .event-content p {
    margin: 0;
    line-height: 1.5;
  }
</style>
