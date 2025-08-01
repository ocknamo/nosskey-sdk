<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { logout } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';

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

<CardSection title={$i18n.t.settings.logout.title}>
  <p>
    {$i18n.t.settings.logout.description}
  </p>

  <Button variant="danger" onclick={logoutFromApp}>
    {$i18n.t.settings.logout.button}
  </Button>

  {#if logoutMessage}
    <div class="result-message">
      {logoutMessage}
    </div>
  {/if}
</CardSection>

<style>
  p {
    margin-bottom: 15px;
    color: var(--color-text-muted);
  }

  .result-message {
    margin-top: 15px;
    padding: 10px;
    background-color: var(--color-surface);
    border-radius: 4px;
    font-weight: bold;
  }
</style>
