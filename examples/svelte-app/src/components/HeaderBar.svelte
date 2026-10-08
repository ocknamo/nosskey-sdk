<script lang="ts">
import NosskeyLogo from '../assets/nosskey.svg';
import { i18n } from '../i18n/i18n-store.js';
import { currentScreen, type ScreenName } from '../store/app-state.js';
import { NAV_ITEMS } from './nav-items.js';

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

// 画面遷移処理（PC のヘッダーナビ用）
function navigateTo(target: ScreenName) {
  currentScreen.set(target);
}
</script>

<header class="header-bar">
  <div class="header-content">
    <div class="header-left">
      <img class="app-logo" src={NosskeyLogo} alt="" width="28" height="28" />
      <h1 class="app-title">Nosskey</h1>
    </div>
    <!-- モバイル: 中央にページタイトル（ナビはフッター） -->
    <div class="header-center">
      <span class="page-title">{getPageTitle(screen)}</span>
    </div>
    <!-- PC: フッターの代わりにヘッダー右側へナビを置く -->
    <nav class="header-nav" aria-label={$i18n.t.navigation.mainNav}>
      {#each NAV_ITEMS as item (item.screen)}
        <button
          type="button"
          class="header-nav__item"
          class:active={screen === item.screen}
          aria-current={screen === item.screen ? "page" : undefined}
          onclick={() => navigateTo(item.screen)}
        >
          <img src={item.icon} alt="" />
          <span>{$i18n.t.navigation[item.screen]}</span>
        </button>
      {/each}
    </nav>
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
    /* 背面のコンテンツをうっすら透かすすりガラス風（color-mix 非対応時は不透明） */
    background-color: var(--color-card);
    background-color: color-mix(in srgb, var(--color-card) 82%, transparent);
    -webkit-backdrop-filter: saturate(180%) blur(16px);
    backdrop-filter: saturate(180%) blur(16px);
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
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 16px;
    height: 56px;
  }

  .header-left {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .app-logo {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .app-title {
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--color-titles);
    margin: 0;
    transition: color 0.3s ease;
  }

  .header-center {
    flex: 2;
    text-align: center;
  }

  .page-title {
    font-size: 1rem;
    font-weight: 700;
    /* テーマのフォント（neutral では丸ゴシック）に追従させる。 */
    font-family: var(--font-family);
    color: var(--color-titles);
    letter-spacing: -0.02em;
    transition: color 0.3s ease;
  }

  .header-right {
    flex: 1;
    display: flex;
    justify-content: flex-end;
  }

  .header-nav {
    display: none;
  }

  /* PC: ページタイトルの代わりにナビのピルを並べる */
  @media (min-width: 960px) {
    .header-center,
    .header-right {
      display: none;
    }

    .header-nav {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border-radius: 999px;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
    }

    .header-nav__item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      border: none;
      border-radius: 999px;
      background: none;
      color: var(--color-text-secondary);
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 0.2s ease,
        color 0.2s ease;
    }

    .header-nav__item:hover:not(.active) {
      background-color: var(--color-surface-hover);
      color: var(--color-text);
    }

    .header-nav__item:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px var(--color-button-primary);
    }

    .header-nav__item.active {
      background-color: var(--color-primary-alpha-20);
      /* 淡い塗りの上でも本文サイズのコントラストを確保するため一段濃い（暗色では明るい）色 */
      color: var(--color-secondary);
      font-weight: 600;
    }

    .header-nav__item img {
      width: 18px;
      height: 18px;
      transition: filter 0.2s ease;
      filter: brightness(0) saturate(100%) invert(50%) sepia(0%) saturate(0%)
        hue-rotate(0deg) brightness(100%) contrast(70%);
    }

    .header-nav__item.active img {
      filter: var(--icon-filter-primary);
    }
  }

  /* レスポンシブ対応 */
  @media (max-width: 600px) {
    .header-content {
      padding: 0 12px;
    }

    .app-title {
      font-size: 1.05rem;
    }

    .page-title {
      font-size: 0.9rem;
    }
  }
</style>
