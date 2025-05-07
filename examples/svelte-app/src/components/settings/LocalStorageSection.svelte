<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { currentScreen, resetState } from '../../store/app-state.js';
import SettingSection from './SettingSection.svelte';

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

<SettingSection title={$i18n.t.settings.localStorage.title}>
  <p>
    {$i18n.t.settings.localStorage.description}
  </p>

  <button class="danger-button" onclick={clearLocalStorage}>
    {$i18n.t.settings.localStorage.clear}
  </button>

  {#if clearResult}
    <div class="result-message">
      {clearResult}
    </div>
  {/if}
</SettingSection>

<style>
  p {
    margin-bottom: 15px;
    color: #666;
  }

  .danger-button {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 10px;
  }

  .danger-button:hover {
    background-color: #c82333;
  }

  .result-message {
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
    font-weight: bold;
  }
</style>
