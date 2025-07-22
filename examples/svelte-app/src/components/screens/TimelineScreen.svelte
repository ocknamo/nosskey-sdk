<script lang="ts">
import { onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { isLoggedIn, publicKey } from '../../store/app-state.js';
import { relayService } from '../../store/relay-store.js';
import { setTimelineMode, timelineMode } from '../../store/timeline-store.js';
import PostForm from '../PostForm.svelte';
// biome-ignore lint: svelte
import Timeline from '../Timeline.svelte';
import TabButton from '../ui/button/TabButton.svelte';

let timeline: Timeline;

// 状態変数
let login = $state(false);
let currentMode = $state<'global' | 'user'>('global');
let currentPublicKey = $state<string | null>(null);
let loading = $state(false);

// ストアを監視
$effect(() => {
  login = $isLoggedIn;
  currentMode = $timelineMode;
  currentPublicKey = $publicKey;
});

// グローバルモードに切り替え
async function switchToGlobal() {
  if (currentMode !== 'global') {
    loading = true;
    setTimelineMode('global');
    // データを再取得
    try {
      await relayService.fetchTimelineByMode('global', null);
    } finally {
      loading = false;
    }
  }
}

// ユーザーモードに切り替え（認証済みのみ）
async function switchToUser() {
  if (login && currentPublicKey && currentMode !== 'user') {
    loading = true;
    setTimelineMode('user');
    // データを再取得
    try {
      await relayService.fetchTimelineByMode('user', currentPublicKey);
    } finally {
      loading = false;
    }
  }
}

async function sync() {
  await timeline.syncTimeline();
}

onMount(async () => {
  console.log('TimelineScreen mounted');

  // 初期タイムラインをロード
  loading = true;
  try {
    if (login && currentPublicKey && currentMode === 'user') {
      await relayService.fetchTimelineByMode('user', currentPublicKey);
    } else {
      await relayService.fetchTimelineByMode('global', null);
    }
  } finally {
    loading = false;
  }
});
</script>

<div class="timeline-screen">
  <h1 class="screen-title">{$i18n.t.nostr.timeline.title}</h1>

  <!-- モード切り替えタブ -->
  <div class="timeline-tabs">
    <TabButton
      onclick={switchToGlobal}
      disabled={loading}
      active={currentMode === "global"}
      className="tab-button"
    >
      {$i18n.t.nostr.timeline.globalFeed}
    </TabButton>

    {#if login}
      <TabButton
        onclick={switchToUser}
        disabled={loading}
        active={currentMode === "user"}
        className="tab-button"
      >
        {$i18n.t.nostr.timeline.userFeed}
      </TabButton>
    {/if}
  </div>

  {#if login}
    <!-- 認証済みの場合は投稿フォームを表示 -->
    <PostForm post={sync} />
  {/if}

  <!-- タイムライン -->
  <Timeline bind:this={timeline} />
</div>

<style>
  .timeline-screen {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 64px; /* フッターメニューの高さを確保 */
  }

  .timeline-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 10px;
    transition: border-color 0.3s ease;
  }
</style>
