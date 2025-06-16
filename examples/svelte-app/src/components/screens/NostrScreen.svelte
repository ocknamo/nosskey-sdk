<script lang="ts">
  import { onDestroy } from "svelte";
  import type { NostrEvent } from "../../../../../src/types.js";
  import { i18n } from "../../i18n/i18n-store.js";
  import { getPWKManager } from "../../services/pwk-manager.service.js";
  import type { RelayInfo } from "../../services/relay.service.js";
  import * as appState from "../../store/app-state.js";
  import { relayService } from "../../store/relay-store.js";
  import ProfileEditor from "../ProfileEditor.svelte";
  import Timeline from "../Timeline.svelte";

  // 状態変数
  let eventContent = $state("");
  // イベント種類は常にkind=1(テキストノート)
  const eventKind = 1;
  let signedEvent = $state<NostrEvent | null>(null);
  let publishStatus = $state("");
  let isLoading = $state(false);
  let publicKeyShort = $state("");
  let npubAddress = $state("");
  let relayStatuses = $state<{ [url: string]: RelayInfo }>({});

  // PWKManagerのシングルトンインスタンスを取得
  const pwkManager = getPWKManager();

  // リレーサービスからの状態をサブスクライブ
  const unsubscribeRelayStatus = relayService.relayStatuses.subscribe(
    (value) => {
      relayStatuses = value;
    },
  );

  // 公開ステータスのサブスクリプション
  const unsubscribePublishStatus = relayService.publishStatus.subscribe(
    (value) => {
      publishStatus = value;
    },
  );

  // コンポーネント破棄時にサブスクリプションを解除
  onDestroy(() => {
    unsubscribeRelayStatus();
    unsubscribePublishStatus();
  });

  // パブリックキーを取得
  let publicKeyValue = "";
  appState.publicKey.subscribe((value) => {
    publicKeyValue = value || "";

    if (publicKeyValue) {
      // 公開鍵を表示用に整形
      publicKeyShort = `${publicKeyValue.slice(0, 8)}...${publicKeyValue.slice(-8)}`;
      npubAddress = `npub形式 (実装省略: ${publicKeyValue.slice(0, 6)}...)`;
    }
  });

  // イベント内容が変更されたときのハンドラー
  function handleContentChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    eventContent = textarea.value;
  }

  // イベントに署名
  async function signEvent() {
    if (!eventContent.trim()) {
      publishStatus = "コンテンツを入力してください";
      return;
    }

    isLoading = true;
    publishStatus = "署名中...";

    try {
      if (!publicKeyValue) {
        throw new Error("公開鍵が見つかりません");
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
        publishStatus = "署名完了";
      }
    } catch (error) {
      console.error("署名エラー:", error);
      publishStatus = `署名エラー: ${error instanceof Error ? error.message : String(error)}`;
      signedEvent = null;
    } finally {
      isLoading = false;
    }
  }

  // イベントをリレーに送信
  async function publishEvent() {
    if (!signedEvent) {
      publishStatus = "まず署名してください";
      return;
    }

    isLoading = true;

    try {
      // リレーサービスを使用してイベントを送信
      console.log("送信先リレー:", appState.defaultRelays);
      console.log("署名済みイベント:", signedEvent);

      await relayService.publishEvent(signedEvent);
    } catch (error) {
      console.error("送信エラー:", error);
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
  <h1>{$i18n.t.nostr.title}</h1>

  <div class="user-info">
    <div class="pubkey-display">
      <h3>{$i18n.t.nostr.publicKey}</h3>
      <p>{publicKeyShort}</p>
      <p class="npub">{npubAddress}</p>
    </div>

    <div class="relay-status">
      <h3>{$i18n.t.nostr.relayStatus}</h3>
      <ul>
        {#each Object.entries(relayStatuses) as [url, status]}
          <li>
            <span class="relay-url">{url}</span>
            <span class="status-badge status-{status.status}">
              {status.status === "active"
                ? $i18n.t.nostr.relayStates.connected
                : status.status === "connecting"
                  ? $i18n.t.nostr.relayStates.connecting
                  : status.status === "closed"
                    ? $i18n.t.nostr.relayStates.disconnected
                    : $i18n.t.nostr.relayStates.unknown}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <div class="event-creation">
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

    <!-- プロフィール編集コンポーネント -->
    <ProfileEditor />

    <!-- タイムラインコンポーネント -->
    <Timeline />
  </div>

  <!-- フッターメニューに移動したため、ログアウトボタンは削除 -->
</div>

<style>
  .nostr-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }

  h1,
  h2,
  h3 {
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

  .relay-status {
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
  }

  .relay-status ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .relay-status li {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    padding: 5px;
    border-bottom: 1px solid #eee;
  }

  .relay-url {
    font-family: monospace;
    word-break: break-all;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    margin-left: 10px;
    white-space: nowrap;
  }

  .status-active {
    background-color: #28a745;
    color: white;
  }

  .status-connecting {
    background-color: #ffc107;
    color: black;
  }

  .status-closed,
  .status-error {
    background-color: #dc3545;
    color: white;
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

  textarea {
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
</style>
