<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { currentScreen, resetState } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import DangerButton from '../ui/button/DangerButton.svelte';

// 状態変数
let clearResult = $state('');

// ローカルストレージをクリアする関数
function clearLocalStorage() {
  try {
    // ローカルストレージのすべてのキーを削除
    localStorage.clear();

    // メッセージを表示
    clearResult = $i18n.t.settings.localStorage.cleared;

    // アプリケーションの状態をリセット
    resetState();

    // 3秒後にメッセージをクリア
    setTimeout(() => {
      clearResult = '';
      // 認証画面に戻る
      currentScreen.set('account');
    }, 3000);
  } catch (error) {
    clearResult = `エラー: ${error instanceof Error ? error.message : String(error)}`;
  }
}
</script>

<CardSection title={$i18n.t.settings.localStorage.title}>
  <p>
    {$i18n.t.settings.localStorage.description}
  </p>

  <DangerButton onclick={clearLocalStorage}>
    {$i18n.t.settings.localStorage.clear}
  </DangerButton>

  {#if clearResult}
    <div class="result-message">
      {clearResult}
    </div>
  {/if}
</CardSection>

<style>
  p {
    margin-bottom: 15px;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  .result-message {
    margin-top: 15px;
    padding: 10px;
    background-color: var(--color-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-weight: bold;
    color: var(--color-text);
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease,
      color 0.3s ease;
  }
</style>
