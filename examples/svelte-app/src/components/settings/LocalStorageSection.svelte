<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import { currentScreen, logout } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';

// 状態変数
let clearResult = $state('');

// ローカルストレージをクリアする関数
function clearLocalStorage() {
  try {
    // SDK 管理の鍵情報（current スロット・登録簿・派生キャッシュ・in-memory 状態）を
    // SDK の実ストレージハンドル経由で完全に消す。SAA grant 後やスタンドアロンの
    // CookieStorage/MultiStorage 経路では SDK ハンドルが window.localStorage と別参照に
    // なりうるため、window.localStorage.clear() だけでは登録簿やキャッシュを取りこぼす。
    getNosskeyManager().clearStoredKeyInfo();

    // アプリ設定（リレー・信頼済みオリジン・テーマ等）を window.localStorage から削除。
    localStorage.clear();

    // メッセージを表示
    clearResult = $i18n.t.settings.localStorage.cleared;

    // アプリケーションの状態（公開鍵・ログイン状態・画面）をリセットする。
    logout();

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

  <Button variant="danger" onclick={clearLocalStorage}>
    {$i18n.t.settings.localStorage.clear}
  </Button>

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
