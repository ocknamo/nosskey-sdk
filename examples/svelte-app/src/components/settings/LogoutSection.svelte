<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { logout } from '../../store/app-state.js';
import SettingSection from './SettingSection.svelte';

// 状態変数
let logoutMessage = $state('');

// ログアウト関数
function logoutFromApp() {
  logout();
  logoutMessage = $i18n.t.settings.logout.success;

  // 3秒後にメッセージをクリア
  setTimeout(() => {
    logoutMessage = '';
  }, 3000);
}
</script>

<SettingSection title={$i18n.t.settings.logout.title}>
  <p>
    {$i18n.t.settings.logout.description}
  </p>

  <button class="danger-button" onclick={logoutFromApp}>
    {$i18n.t.settings.logout.button}
  </button>

  {#if logoutMessage}
    <div class="result-message">
      {logoutMessage}
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
