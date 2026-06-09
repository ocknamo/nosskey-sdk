<script lang="ts">
import { i18n } from '../i18n/i18n-store.js';
import { currentScreen } from '../store/app-state.js';

// 現在の画面を監視
let screen = $state('account');

currentScreen.subscribe((value) => {
  screen = value;
});

// 画面名に応じたタイトルを取得
function getPageTitle(screenName: string): string {
  switch (screenName) {
    case 'account':
      return $i18n.t.navigation.account;
    case 'key':
      return $i18n.t.navigation.key;
    case 'settings':
      return $i18n.t.navigation.settings;
    default:
      return 'Nosskey';
  }
}
</script>

<header class="header-bar">
  <div class="header-content">
    <div class="header-left">
      <h1 class="app-title">Nosskey</h1>
    </div>
    <div class="header-center">
      <span class="page-title">{getPageTitle(screen)}</span>
    </div>
    <div class="header-right">
      <!-- 将来的にメニューボタンなどを配置 -->
    </div>
  </div>
</header>

<style>
  .header-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: var(--color-card);
    box-shadow: 0 2px 10px var(--color-shadow);
    z-index: 100;
    border-bottom: var(--border-width, 1px) solid var(--color-border);
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 800px;
    margin: 0 auto;
    padding: 0 16px;
    height: 56px;
  }

  .header-left {
    flex: 1;
  }

  .app-title {
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--color-primary);
    margin: 0;
    transition: color 0.3s ease;
  }

  .header-center {
    flex: 2;
    text-align: center;
  }

  .page-title {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
      "Helvetica Neue", Arial, sans-serif;
    color: var(--color-titles);
    letter-spacing: -0.02em;
    transition: color 0.3s ease;
  }

  .header-right {
    flex: 1;
    display: flex;
    justify-content: flex-end;
  }

  /* レスポンシブ対応 */
  @media (max-width: 600px) {
    .header-content {
      padding: 0 12px;
    }

    .app-title {
      font-size: 1.1rem;
    }

    .page-title {
      font-size: 0.9rem;
    }
  }
</style>
