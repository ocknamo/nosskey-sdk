<script lang="ts">
  import { goto } from '$app/navigation';
  import { Nosskey } from 'nosskey-sdk';
  import type { Event as NostrEvent } from 'nostr-typedef';
  import { type RxNostr, createRxNostr } from 'rx-nostr';
  import { seckeySigner, verifier } from 'rx-nostr-crypto';
  import type { Subscription } from 'rxjs';
  import { onMount } from 'svelte';
  import i18n from '../../lib/i18n/index.js';
  import { type DerivedKey, derivedKey, isAuthenticated, nosskeyInstance, userId } from '../../lib/stores/nosskey-store.js';
  
  type StatusType = {
    success: boolean;
    message: string;
  } | null;
  
  
  // i18nから翻訳関数を取得
  const { t } = i18n;
  // 状態変数
  let publicKeyHex = '';
  let messageValue = '';
  let isSending = false;
  let status: StatusType = null;
  const relays = ['wss://relay.damus.io', 'wss://relay.snort.social'];
  // RxNostrインスタンス
  let rxNostr: RxNostr | null = null;
  
  // 入力ハンドラ
  function handleInput(e: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
    const target = e.currentTarget;
    messageValue = target.value;
  }
  
  // リダイレクト処理（認証されていない場合はログインページへ）
  onMount(() => {
    if (!$isAuthenticated || !$derivedKey) {
      goto('/login');
      return;
    }
    
    const derivedKeyValue = $derivedKey as DerivedKey;
    
    if (derivedKeyValue.pk) {
      publicKeyHex = Nosskey.toHex(derivedKeyValue.pk);
    }

    // rx-nostrインスタンスの初期化
    if (derivedKeyValue.sk) {
      const skHex = Nosskey.toHex(derivedKeyValue.sk);
      rxNostr = createRxNostr({
        signer: seckeySigner(skHex),
        verifier: verifier
      });
      
      // リレーの設定
      rxNostr.setDefaultRelays(relays);
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
    
    if (!$derivedKey) {
      status = {
        success: false,
        message: $t('secret_key_missing')
      };
      return;
    }
    
    const derivedKeyValue = $derivedKey as DerivedKey;
    
    if (!derivedKeyValue.sk) {
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
      const nostrEvent: Omit<NostrEvent, 'id' | 'sig'> = {
        kind: 1,
        content: messageValue,
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: publicKeyHex
      };
      
      // 秘密鍵を16進数形式に変換
      const skHex = Nosskey.toHex(derivedKeyValue.sk);
      
      if (!rxNostr) {
        // rxNostrがまだ初期化されていない場合は初期化する
        rxNostr = createRxNostr({
          signer: seckeySigner(skHex),
          verifier: verifier
        });
        rxNostr.setDefaultRelays(relays);
      }
      
      // rx-nostrを使用してNostrイベントを送信
      const sub: Subscription = rxNostr.send({ ...nostrEvent }).subscribe({
        next: (packet: { type: string }) => {
          if (packet && packet.type === 'ok') {
            status = {
              success: true,
              message: $t('message_sent')
            };
            isSending = false;
            messageValue = ''; // 送信後にフォームをクリア
          }
        },
        error: (error: unknown) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          status = {
            success: false,
            message: `${$t('error_occurred')}: ${errorMsg}`
          };
          isSending = false;
        },
        complete: () => {
          // 処理完了
        }
      });
      
      // タイムアウト処理（10秒後にまだ処理中なら失敗とする）
      setTimeout(() => {
        if (sub && !sub.closed) {
          sub.unsubscribe();
          if (isSending) {
            status = {
              success: false,
              message: $t('message_timeout')
            };
            isSending = false;
          }
        }
      }, 10000);
      
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
