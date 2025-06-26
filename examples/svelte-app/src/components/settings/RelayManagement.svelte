<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { defaultRelays } from '../../store/app-state.js';
import { activeRelays } from '../../store/relay-store.js';
import Button from '../ui/Button.svelte';
import CardSection from '../ui/CardSection.svelte';
import DangerButton from '../ui/DangerButton.svelte';
import SecondaryButton from '../ui/SecondaryButton.svelte';

// 状態変数
let newRelay = $state('');
let relayMessage = $state('');
let relays = $state<string[]>([]);

// ストアを監視して更新
activeRelays.subscribe((value) => {
  relays = value;
});

// リレーを追加する関数
function addRelay() {
  if (!newRelay) {
    relayMessage = $i18n.t.settings.relayManagement.messages.enterUrl;
    return;
  }

  // 簡易的なバリデーション
  if (!newRelay.startsWith('wss://')) {
    relayMessage = $i18n.t.settings.relayManagement.messages.startWithWss;
    return;
  }

  // すでに存在するかチェック
  if (relays.includes(newRelay)) {
    relayMessage = $i18n.t.settings.relayManagement.messages.alreadyExists;
    return;
  }

  // リレーを追加（activeRelaysストアを更新）
  activeRelays.update((currentRelays) => [...currentRelays, newRelay]);

  // 入力フィールドをクリア
  newRelay = '';
  relayMessage = $i18n.t.settings.relayManagement.messages.added;

  // 3秒後にメッセージをクリア
  setTimeout(() => {
    relayMessage = '';
  }, 3000);
}

// リレーを削除する関数
function removeRelay(relay: string) {
  // activeRelaysストアを更新
  activeRelays.update((currentRelays) => currentRelays.filter((r) => r !== relay));

  relayMessage = $i18n.t.settings.relayManagement.messages.deleted;

  // 3秒後にメッセージをクリア
  setTimeout(() => {
    relayMessage = '';
  }, 3000);
}

// リレーをデフォルトにリセットする関数
function resetRelays() {
  // デフォルト値にリセット
  activeRelays.set([...defaultRelays]);

  relayMessage = $i18n.t.settings.relayManagement.messages.reset;

  // 3秒後にメッセージをクリア
  setTimeout(() => {
    relayMessage = '';
  }, 3000);
}
</script>

<CardSection title={$i18n.t.settings.relayManagement.title}>
  <p>{$i18n.t.settings.relayManagement.description}</p>

  <div class="relay-list">
    <h3>{$i18n.t.settings.relayManagement.currentRelays}</h3>
    {#if relays.length === 0}
      <p class="empty-message">{$i18n.t.settings.relayManagement.noRelays}</p>
    {:else}
      <ul>
        {#each relays as relay}
          <li>
            <span class="relay-url">{relay}</span>
            <DangerButton onclick={() => removeRelay(relay)} size="small">
              {$i18n.t.settings.relayManagement.delete}
            </DangerButton>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="add-relay">
    <h3>{$i18n.t.settings.relayManagement.addRelay}</h3>
    <div class="input-group">
      <input type="text" placeholder="wss://" bind:value={newRelay} />
      <Button onclick={addRelay}>{$i18n.t.settings.relayManagement.add}</Button>
    </div>
    <SecondaryButton onclick={resetRelays}>
      {$i18n.t.settings.relayManagement.reset}
    </SecondaryButton>

    {#if relayMessage}
      <div class="result-message">
        {relayMessage}
      </div>
    {/if}
  </div>
</CardSection>

<style>
  p {
    margin-bottom: 15px;
    color: var(--color-text-muted);
  }

  .relay-list {
    margin-bottom: 20px;
  }

  .relay-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .relay-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    margin-bottom: 5px;
    background-color: var(--color-surface);
    border-radius: 4px;
  }

  .relay-url {
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 10px;
  }

  .empty-message {
    color: var(--color-text-disabled);
    font-style: italic;
  }

  .input-group {
    display: flex;
    margin-bottom: 10px;
  }

  .input-group input {
    flex: 1;
    padding: 10px;
    border: 1px solid var(--color-border-strong);
    border-radius: 4px 0 0 4px;
    font-size: 1rem;
  }

  .result-message {
    margin-top: 15px;
    padding: 10px;
    background-color: var(--color-surface);
    border-radius: 4px;
    font-weight: bold;
  }
</style>
