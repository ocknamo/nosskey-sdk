<script>
  import { onMount } from 'svelte';
  import { createRxNostr } from 'rx-nostr';
  import { publicKey, signNostrEvent } from '../stores/nosskey-store.js';
  
  let message = '';
  let sending = false;
  let error = null;
  let success = false;
  
  // リレーリスト
  const relays = ['wss://relay.damus.io', 'wss://relay.snort.social', 'wss://nos.lol'];
  let rxNostr;
  
  onMount(() => {
    rxNostr = createRxNostr({ relays });
    rxNostr.connect();
    return () => rxNostr.dispose();
  });
  
  async function handleSubmit() {
    if (!message.trim()) return;
    
    sending = true;
    error = null;
    success = false;
    
    try {
      // イベントの作成
      const event = {
        kind: 1,
        content: message,
        tags: [],
        created_at: Math.floor(Date.now() / 1000)
      };
      
      // 署名（パスキー認証が必要）
      const signedEvent = await signNostrEvent(event);
      
      // リレーに送信
      await rxNostr.writeOrFail(signedEvent);
      
      success = true;
      message = '';
    } catch (err) {
      error = err.message || '送信エラーが発生しました';
      console.error('送信エラー:', err);
    } finally {
      sending = false;
    }
  }
</script>

<div class="nostr-form">
  <h2>メッセージを投稿</h2>
  
  <div class="user-info">
    <p>公開鍵: <code>{$publicKey ? $publicKey.substring(0, 8) + '...' : '読み込み中...'}</code></p>
  </div>
  
  <form on:submit|preventDefault={handleSubmit}>
    <textarea 
      bind:value={message} 
      placeholder="メッセージを入力..."
      disabled={sending}
    ></textarea>
    
    <button type="submit" disabled={sending || !message.trim()}>
      {sending ? '送信中...' : '投稿する'}
    </button>
  </form>
  
  {#if error}
    <div class="error">{error}</div>
  {/if}
  
  {#if success}
    <div class="success">メッセージを送信しました！</div>
  {/if}
</div>

<style>
  .nostr-form {
    margin: 20px 0;
  }
  
  h2 {
    margin-bottom: 1rem;
  }
  
  .user-info {
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  code {
    background-color: #f1f3f5;
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }
  
  textarea {
    width: 100%;
    height: 100px;
    padding: 8px;
    margin-bottom: 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    resize: vertical;
  }
  
  button {
    padding: 8px 16px;
    background: #5c6bc0;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }
  
  button:disabled {
    background: #9e9e9e;
    cursor: not-allowed;
  }
  
  .error {
    color: #d32f2f;
    margin-top: 10px;
    padding: 8px;
    background-color: #ffebee;
    border-radius: 4px;
  }
  
  .success {
    color: #388e3c;
    margin-top: 10px;
    padding: 8px;
    background-color: #e8f5e9;
    border-radius: 4px;
  }
</style>
