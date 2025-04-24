<script>
  import { goto } from '$app/navigation';
  import { Nosskey } from 'nosskey-sdk';
  import { onMount } from 'svelte';
  import i18n from '../../lib/i18n/index.js';
  import { derivedKey, isAuthenticated, nosskeyInstance, userId } from '../../lib/stores/nosskey-store.js';
  
  // i18nから翻訳関数を取得
  const { t } = i18n;
  
  // 状態変数
  let publicKeyHex = '';
  let messageValue = '';
  let isSending = false;
  let status = null;
  const relays = ['wss://relay.damus.io', 'wss://relay.snort.social'];
  
  // 入力ハンドラ
  function handleInput(e) {
    messageValue = e.target.value;
  }
  
  // リダイレクト処理（認証されていない場合はログインページへ）
  onMount(() => {
    if (!$isAuthenticated || !$derivedKey) {
      goto('/login');
      return;
    }
    
    if ($derivedKey?.pk) {
      publicKeyHex = Nosskey.toHex($derivedKey.pk);
    }
  });
  
  // Nostrメッセージ送信
  async function sendNostrMessage() {
    if (!messageValue.trim()) {
      status = {
        success: false,
        message: $t('enter_message')
      };
      return;
    }
    
    if (!$derivedKey?.sk) {
      status = {
        success: false,
        message: $t('secret_key_missing')
      };
      return;
    }
    
    isSending = true;
    status = null;
    
    try {
      // Nostrイベント作成
      const event = {
        kind: 1,
        content: messageValue,
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: publicKeyHex
      };
      
      // 秘密鍵を16進数形式に変換
      const skHex = Nosskey.toHex($derivedKey.sk);
      
      // ここでrx-nostrのimportと初期化を行う予定だが、
      // ブラウザ環境でのテストが必要なため、実際の実装では調整が必要
      
      // モックの成功レスポンス（実際の実装では、rx-nostrを使用）
      setTimeout(() => {
        status = {
          success: true,
          message: $t('message_sent')
        };
        isSending = false;
        messageValue = ''; // 送信後にフォームをクリア
      }, 1000);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      status = {
        success: false,
        message: `${$t('error_occurred')}: ${errorMsg}`
      };
      isSending = false;
    }
  }
  
  // ログアウト処理
  function handleLogout() {
    userId.set('');
    nosskeyInstance.set(null);
    derivedKey.set(null);
    isAuthenticated.set(false);
    goto('/');
  }
</script>

<div class="card">
  <h2>{$t('nostr_title')}</h2>
  
  <div class="user-info">
    <h3>{$t('user_info')}</h3>
    <p>{$t('user_id')}: <strong>{$userId}</strong></p>
    <p>{$t('derived_pubkey')}: <code>{publicKeyHex}</code></p>
  </div>
  
  <div class="relays">
    <h3>{$t('connected_relays')}</h3>
    <ul>
      {#each relays as relay}
        <li>{relay}</li>
      {/each}
    </ul>
  </div>
  
  <div class="message-form">
    <h3>{$t('message_sending')}</h3>
    <p>{$t('message_form_description')}</p>
    
    <form on:submit|preventDefault={sendNostrMessage}>
      <div class="form-group">
        <label for="message">{$t('message')}:</label>
        <textarea
          id="message"
          value={messageValue}
          on:input={handleInput}
          rows="4"
          disabled={isSending}
          placeholder={$t('message_placeholder')}
        ></textarea>
      </div>
      
      <button type="submit" disabled={isSending}>
        {isSending ? $t('sending_message') : $t('send_message')}
      </button>
    </form>
    
    {#if status}
      <div class={status.success ? 'success' : 'error'}>
        <p>{status.message}</p>
      </div>
    {/if}
  </div>
  
  <div class="actions">
    <button class="secondary" on:click={handleLogout}>
      {$t('logout')}
    </button>
  </div>
</div>

<style>
  .user-info, .relays, .message-form, .actions {
    margin-bottom: 2rem;
  }
  
  .relays ul {
    padding-left: 1.5rem;
  }
  
  textarea {
    height: 120px;
    resize: vertical;
  }
  
  .actions {
    display: flex;
    justify-content: flex-end;
  }
  
  button.secondary {
    background-color: #6c757d;
  }
  
  code {
    display: block;
    padding: 0.5rem;
    background-color: #f0f0f0;
    border-radius: 4px;
    margin: 0.5rem 0;
    word-break: break-all;
    font-family: monospace;
  }
</style>
