<script lang="ts">
import { onMount } from 'svelte';
import { i18n } from '../i18n/i18n-store.js';
import { isLoggedIn, publicKey } from '../store/app-state.js';
import { relayService } from '../store/relay-store.js';
import { setTimelineMode, timelineMode } from '../store/timeline-store.js';
import PostForm from './PostForm.svelte';
import Timeline from './Timeline.svelte';

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
  <h1>{$i18n.t.nostr.timeline.title}</h1>

  <!-- モード切り替えタブ -->
  <div class="timeline-tabs">
    <button
      class="tab-button {currentMode === 'global' ? 'active' : ''}"
      onclick={switchToGlobal}
      disabled={loading}
    >
      {$i18n.t.nostr.timeline.globalFeed}
    </button>

    {#if login}
      <button
        class="tab-button {currentMode === 'user' ? 'active' : ''}"
        onclick={switchToUser}
        disabled={loading}
      >
        {$i18n.t.nostr.timeline.userFeed}
      </button>
    {/if}
  </div>

  {#if login}
    <!-- 認証済みの場合は投稿フォームを表示 -->
    <PostForm />
  {/if}

  <!-- タイムライン -->
  <Timeline />
</div>

<style>
  .timeline-screen {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 80px; /* フッターメニューの高さを確保 */
  }

  h1 {
    font-size: 1.8rem;
    margin-bottom: 20px;
    text-align: center;
  }

  .timeline-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
  }

  .tab-button {
    padding: 8px 16px;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
  }

  .tab-button.active {
    background-color: #5755d9;
    color: white;
    font-weight: bold;
  }

  .tab-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
