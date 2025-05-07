<script lang="ts">
import { onMount } from 'svelte';
import { i18n } from '../i18n/i18n-store.js';
import { isLoggedIn } from '../store/appState.js';
import PostForm from './PostForm.svelte';
import Timeline from './Timeline.svelte';

// 認証状態を監視
let login = $state(false);

// ストアを監視
isLoggedIn.subscribe((value) => {
  login = value;
});

onMount(() => {
  console.log('TimelineScreen mounted');
});
</script>

<div class="timeline-screen">
  {#if !login}
    <!-- 未認証の場合はメッセージを表示 -->
    <div class="auth-required">
      <h2>タイムラインの閲覧には認証が必要です</h2>
      <p>アカウント画面から認証してください</p>
    </div>
  {:else}
    <h1>{$i18n.t.nostr.timeline.title}</h1>

    <!-- 投稿フォーム -->
    <PostForm />

    <!-- タイムライン -->
    <Timeline />
  {/if}
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

  .auth-required {
    text-align: center;
    background-color: #f8f9fa;
    padding: 40px 20px;
    border-radius: 8px;
    margin-top: 40px;
  }

  .auth-required h2 {
    margin-bottom: 16px;
    color: #5755d9;
  }

  .auth-required p {
    color: #666;
  }
</style>
