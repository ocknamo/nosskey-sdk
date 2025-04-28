<script lang="ts">
  import { createRxNostr } from 'rx-nostr';
  import { PWKManager } from '../../../../src/nosskey.js';
  import type { NostrEvent, PWKBlob } from '../../../../src/types.js';
  import * as appState from '../store/appState.js';

  // 状態変数
  let eventContent = $state('');
  let eventKind = $state(1); // デフォルトはテキストノート
  let signedEvent = $state<NostrEvent | null>(null);
  let publishStatus = $state('');
  let isLoading = $state(false);
  let relayUrl = $state('wss://relay.damus.io');
  let publicKeyShort = $state('');
  let npubAddress = $state('');

  // PWKManagerのインスタンスを作成
  const pwkManager = new PWKManager();

  // パブリックキーを取得
  let publicKeyValue = '';
  appState.publicKey.subscribe(value => {
    publicKeyValue = value || '';
    
    if (publicKeyValue) {
      // 公開鍵を表示用に整形
      publicKeyShort = `${publicKeyValue.slice(0, 8)}...${publicKeyValue.slice(-8)}`;
      npubAddress = `npub形式 (実装省略: ${publicKeyValue.slice(0, 6)}...)`;
    }
  });

  // イベント種類が変更されたときのハンドラー
  function handleKindChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    eventKind = Number.parseInt(select.value, 10);
  }

  // イベント内容が変更されたときのハンドラー
  function handleContentChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    eventContent = textarea.value;
  }

  // リレーURLが変更されたときのハンドラー
  function handleRelayChange(event: Event) {
    const input = event.target as HTMLInputElement;
    relayUrl = input.value;
  }

  // イベントに署名
  async function signEvent() {
    if (!eventContent.trim()) {
      publishStatus = 'コンテンツを入力してください';
      return;
    }

    isLoading = true;
    publishStatus = '署名中...';

    try {
      // サブスクライブしている値を取得
      let credValue: Uint8Array | null = null;
      let pwkValue: PWKBlob | null = null;
      
      // 一時的なサブスクリプションを作成して値を取得
      const unsubCred = appState.credentialId.subscribe(value => {
        credValue = value;
      });
      const unsubPwk = appState.pwkBlob.subscribe(value => {
        pwkValue = value;
      });
      
      // サブスクリプションを解除
      unsubCred();
      unsubPwk();
      
      if (!publicKeyValue || !pwkValue || !credValue) {
        throw new Error('認証情報が見つかりません');
      }

      // イベントの作成
      const event: NostrEvent = {
        kind: eventKind,
        content: eventContent,
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      };

      // イベントに署名
      signedEvent = await pwkManager.signEvent(event, pwkValue, credValue);
      
      if (signedEvent.id) {
        publishStatus = `署名完了: ${signedEvent.id.slice(0, 8)}...`;
      } else {
        publishStatus = '署名完了';
      }
    } catch (error) {
      console.error('署名エラー:', error);
      publishStatus = `署名エラー: ${error instanceof Error ? error.message : String(error)}`;
      signedEvent = null;
    } finally {
      isLoading = false;
    }
  }

  // イベントをリレーに送信
  async function publishEvent() {
    if (!signedEvent) {
      publishStatus = 'まず署名してください';
      return;
    }

    isLoading = true;
    publishStatus = 'リレーに送信中...';

    try {
      // rx-nostrの実装の代わりにモック実装
      // 実際のリレー接続はここでは行わず、デモとして署名されたイベントを表示するだけにする
      // (インタラクティブな使用のみ)
      console.log('送信先リレー:', relayUrl);
      console.log('署名済みイベント:', signedEvent);
      
      // デモのためエラーなしと想定
      const result = true;
      
      // 署名成功をシミュレート
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      if (result) {
        publishStatus = '送信完了';
      } else {
        publishStatus = '送信タイムアウトまたはエラー';
      }
    } catch (error) {
      console.error('送信エラー:', error);
      publishStatus = `送信エラー: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }

  // ログアウト処理
  function logout() {
    appState.resetState();
  }
</script>

<div class="nostr-container">
  <h1>Nostr</h1>
  
  <div class="user-info">
    <div class="pubkey-display">
      <h3>公開鍵</h3>
      <p>{publicKeyShort}</p>
      <p class="npub">{npubAddress}</p>
    </div>
  </div>
  
  <div class="event-creation">
    <h2>イベント作成</h2>
    
    <div class="form-group">
      <label for="eventKind">イベント種類:</label>
      <select id="eventKind" value={eventKind} on:change={handleKindChange}>
        <option value="1">テキストノート (kind 1)</option>
        <option value="30023">長文記事 (kind 30023)</option>
        <option value="3">お気に入り (kind 3)</option>
      </select>
    </div>
    
    <div class="form-group">
      <label for="content">内容:</label>
      <textarea 
        id="content" 
        value={eventContent}
        on:input={handleContentChange}
        placeholder="ここにメッセージを入力..."
        rows="5"
      ></textarea>
    </div>
    
    <div class="form-group">
      <label for="relay">リレーURL:</label>
      <input id="relay" type="text" value={relayUrl} on:input={handleRelayChange} placeholder="wss://..." />
    </div>
    
    <div class="action-buttons">
      <button 
        class="sign-button" 
        on:click={signEvent} 
        disabled={isLoading || !eventContent.trim()}
      >
        署名
      </button>
      
      <button 
        class="publish-button" 
        on:click={publishEvent} 
        disabled={isLoading || !signedEvent}
      >
        公開
      </button>
    </div>
    
    {#if publishStatus}
      <div class="status-message">
        {publishStatus}
      </div>
    {/if}
    
    {#if signedEvent}
      <div class="signed-event">
        <h3>署名済みイベント</h3>
        <pre>{JSON.stringify(signedEvent, null, 2)}</pre>
      </div>
    {/if}
  </div>
  
  <div class="footer-actions">
    <button class="logout-button" on:click={logout}>ログアウト</button>
  </div>
</div>

<style>
  .nostr-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }
  
  h1, h2, h3 {
    margin-bottom: 10px;
  }
  
  .user-info {
    background-color: #f5f5f5;
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }
  
  .pubkey-display {
    word-break: break-all;
  }
  
  .npub {
    font-size: 0.9rem;
    color: #666;
  }
  
  .event-creation {
    background-color: #fff;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .form-group {
    margin-bottom: 15px;
  }
  
  label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }
  
  input, textarea, select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
  }
  
  textarea {
    resize: vertical;
  }
  
  .action-buttons {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
  
  button {
    padding: 12px 24px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.3s;
  }
  
  .sign-button {
    background-color: #5755d9;
    color: white;
  }
  
  .publish-button {
    background-color: #28a745;
    color: white;
  }
  
  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  .status-message {
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
  }
  
  .signed-event {
    margin-top: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 4px;
    overflow-x: auto;
  }
  
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  .footer-actions {
    margin-top: 30px;
    text-align: right;
  }
  
  .logout-button {
    background-color: #dc3545;
    color: white;
  }
</style>
