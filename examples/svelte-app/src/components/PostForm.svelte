<script lang="ts">
import { onDestroy } from 'svelte';
import type { NostrEvent } from '../../../../src/types.js';
import { i18n } from '../i18n/i18n-store.js';
import { getPWKManager } from '../services/pwk-manager.service.js';
import * as appState from '../store/app-state.js';
import { relayService } from '../store/relay-store.js';

// 状態変数
let eventContent = $state('');
// イベント種類は常にkind=1(テキストノート)
const eventKind = 1;
let signedEvent = $state<NostrEvent | null>(null);
let publishStatus = $state('');
let isLoading = $state(false);

// PWKManagerのシングルトンインスタンスを取得
const pwkManager = getPWKManager();

// 公開ステータスのサブスクリプション
const unsubscribePublishStatus = relayService.publishStatus.subscribe((value) => {
  publishStatus = value;
});

// コンポーネント破棄時にサブスクリプションを解除
onDestroy(() => {
  unsubscribePublishStatus();
});

// イベント内容が変更されたときのハンドラー
function handleContentChange(event: Event) {
  const textarea = event.target as HTMLTextAreaElement;
  eventContent = textarea.value;
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
    // 公開鍵の確認
    let publicKeyValue: string | null = null;
    const unsubPubKey = appState.publicKey.subscribe((value) => {
      publicKeyValue = value;
    });
    unsubPubKey();

    if (!publicKeyValue) {
      throw new Error('公開鍵が見つかりません');
    }

    // イベントの作成
    const event: NostrEvent = {
      kind: eventKind,
      content: eventContent,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    // NIP-07互換のsignEventメソッドを使用
    signedEvent = await pwkManager.signEvent(event);

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

  try {
    // リレーサービスを使用してイベントを送信
    console.log('送信先リレー:', appState.defaultRelays);
    console.log('署名済みイベント:', signedEvent);

    await relayService.publishEvent(signedEvent);

    // 投稿後はフォームをクリア
    eventContent = '';
    signedEvent = null;
  } catch (error) {
    console.error('送信エラー:', error);
    publishStatus = `送信エラー: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}
</script>

<div class="post-form">
  <h2>{$i18n.t.nostr.eventCreation}</h2>

  <div class="form-group">
    <label for="content">{$i18n.t.nostr.content}</label>
    <textarea
      id="content"
      value={eventContent}
      oninput={handleContentChange}
      placeholder={$i18n.t.nostr.contentPlaceholder}
      rows="5"
    ></textarea>
  </div>

  <div class="action-buttons">
    <button
      class="sign-button"
      onclick={signEvent}
      disabled={isLoading || !eventContent.trim()}
    >
      {$i18n.t.nostr.sign}
    </button>

    <button
      class="publish-button"
      onclick={publishEvent}
      disabled={isLoading || !signedEvent}
    >
      {$i18n.t.nostr.publish}
    </button>
  </div>

  {#if publishStatus}
    <div class="status-message">
      {publishStatus}
    </div>
  {/if}

  {#if signedEvent}
    <div class="signed-event">
      <h3>{$i18n.t.nostr.signedEvent}</h3>
      <pre>{JSON.stringify(signedEvent, null, 2)}</pre>
    </div>
  {/if}
</div>

<style>
  .post-form {
    background-color: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: 15px;
  }

  .form-group {
    margin-bottom: 15px;
  }

  label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }

  textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    resize: vertical;
  }

  .action-buttons {
    display: flex;
    gap: 10px;
    margin-top: 15px;
  }

  button {
    padding: 10px 20px;
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
</style>
