<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/stores/app-store.js';
  import { isAuthenticated, publicKey, clearCredentials } from '../lib/stores/nosskey-store.js';
  import NostrForm from '../lib/components/NostrForm.svelte';
  
  // 認証状態をチェック
  onMount(() => {
    if (!$isAuthenticated) {
      navigateTo('home');
    }
  });
  
  function handleLogout() {
    clearCredentials();
    navigateTo('home');
  }
</script>

<div class="nostr-view">
  <h2>Nostr Direct PRF Demo</h2>
  
  <div class="user-info">
    <h3>あなたのアカウント情報</h3>
    <p>
      <strong>公開鍵:</strong> <code>{$publicKey || 'ロード中...'}</code>
    </p>
    <p class="note">
      この公開鍵はPRF拡張から直接導出されたシークレットキーから生成されています。
      毎回同じパスキーを使用すれば、同じ公開鍵が得られます。
    </p>
  </div>
  
  <div class="divider"></div>
  
  <NostrForm />
  
  <div class="actions">
    <button class="danger" on:click={handleLogout}>ログアウト</button>
  </div>
</div>

<style>
  .nostr-view {
    padding: 1rem 0;
  }
  
  .user-info {
    background-color: #e3f2fd;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 2rem;
  }
  
  code {
    background-color: #f1f3f5;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
    word-break: break-all;
  }
  
  .note {
    font-size: 0.9rem;
    color: #6c757d;
    font-style: italic;
    margin-top: 0.5rem;
  }
  
  .divider {
    height: 1px;
    background-color: #e9ecef;
    margin: 2rem 0;
  }
  
  .actions {
    margin-top: 2rem;
    text-align: right;
  }
  
  .danger {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .danger:hover {
    background-color: #c82333;
  }
</style>
