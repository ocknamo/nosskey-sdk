<script lang="ts">
import { onMount } from 'svelte';
import { i18n } from '../i18n/i18n-store.js';
import { currentScreen } from '../store/app-state.js';

// 現在の画面を監視
let screen = $state('account');
let isVisible = $state(false);

currentScreen.subscribe((value) => {
  screen = value;
});

// 画面名に応じたタイトルを取得
function getPageTitle(screenName: string): string {
  switch (screenName) {
    case 'account':
      return $i18n.t.navigation.account;
    case 'timeline':
      return $i18n.t.navigation.timeline;
    case 'settings':
      return $i18n.t.navigation.settings;
    case 'import':
      return 'インポート'; // 追加画面用
    default:
      return 'Nosskey';
  }
}

// h1タイトルの可視性を監視
onMount(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // h1が画面外に出た時にヘッダーバーを表示
        isVisible = !entry.isIntersecting;
      }
    },
    {
      root: null,
      rootMargin: '0px',
      threshold: 0,
    }
  );

  // 画面変更時にh1要素を再監視
  const observeH1 = () => {
    // 既存の監視を停止
    observer.disconnect();

    // 少し遅延してからh1を探す（DOM更新を待つ）
    setTimeout(() => {
      const h1Elements = document.querySelectorAll('.screen-title');
      for (const h1 of h1Elements) {
        observer.observe(h1);
      }
    }, 100);
  };

  // 初回監視開始
  observeH1();

  // 画面変更時に監視対象を更新
  const unsubscribe = currentScreen.subscribe(() => {
    observeH1();
  });

  // クリーンアップ
  return () => {
    observer.disconnect();
    unsubscribe();
  };
});
</script>

<header class="header-bar" class:visible={isVisible}>
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
    border-bottom: 1px solid var(--color-border);
    transform: translateY(-100%);
    transition:
      transform 0.3s ease-in-out,
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  .header-bar.visible {
    transform: translateY(0);
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
