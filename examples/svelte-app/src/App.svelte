<script lang="ts">
import { onMount, tick } from 'svelte';
import FooterMenu from './components/FooterMenu.svelte';
import HeaderBar from './components/HeaderBar.svelte';
import AccountScreen from './components/screens/AccountScreen.svelte';
import IframeHostScreen from './components/screens/IframeHostScreen.svelte';
import KeyManagementScreen from './components/screens/KeyManagement.svelte';
import SettingsScreen from './components/screens/SettingsScreen.svelte';
import { type ThemeMode, currentScreen, currentTheme, isScreenName } from './store/app-state.js';

let screen = $state('account');

// URLのハッシュからページを初期化
function initializeFromHash() {
  const hash = window.location.hash.substring(1);
  const name = hash.startsWith('/') ? hash.substring(1) : hash;
  screen = name || 'account';

  if (isScreenName(screen)) {
    currentScreen.set(screen);
  }
}

// ハッシュ変更時に画面を更新
function handleHashChange() {
  initializeFromHash();
}

// ブラウザの戻る/進む操作の直後はスクロール位置を維持する
let skipNextScrollReset = false;
function handlePopState() {
  skipNextScrollReset = true;
  // hashchange → updateHash の順で flag は消費される想定だが、
  // 万一消費されなくても次の遷移に漏れないようフレーム後にリセットする
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      skipNextScrollReset = false;
    });
  }
}

// 画面遷移時にスクロール位置をトップに戻す
// 新しい画面の DOM 反映やブラウザのスクロール復元と競合しないよう
// 複数タイミングでリセットを行う
function forceScrollTop() {
  window.scrollTo(0, 0);
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = 0;
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

async function scrollToTopAfterRender() {
  if (typeof window === 'undefined') return;
  if (skipNextScrollReset) {
    skipNextScrollReset = false;
    return;
  }
  // 同期的に一度リセット
  forceScrollTop();
  // Svelte の state 更新後にもう一度リセット
  await tick();
  forceScrollTop();
  // 次のペイント後、ブラウザ自動復元や後続レイアウトに対して最後のリセット
  window.requestAnimationFrame(() => {
    forceScrollTop();
  });
}

// ストアの値が変更されたときにURLハッシュを更新
function updateHash(value: string) {
  const screenChanged = screen !== value;

  // URLハッシュの変更によるループを防ぐ
  if (window.location.hash !== `#/${value}`) {
    window.location.hash = `#/${value}`;
  }
  screen = value;

  if (screenChanged) {
    void scrollToTopAfterRender();
  }
}

// subscribe の初回同期コールバックで URL ハッシュが上書きされないよう、
// 購読前にハッシュからストアを初期化しておく。
if (typeof window !== 'undefined') {
  initializeFromHash();
}

// ハッシュ変更のイベントリスナーを設定
$effect(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handlePopState);

    // コンポーネント破棄時にイベントリスナーを削除
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }
});

// ストアの監視
currentScreen.subscribe(updateHash);

// テーマの適用
function applyTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;

  // システム設定を取得
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // 実際に適用するテーマを決定
  const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);

  if (isDark) {
    // Modern Dark Theme
    root.style.setProperty('--color-text', '#FFFFFF');
    root.style.setProperty('--color-titles', '#FFFFFF');
    root.style.setProperty('--color-primary', '#9E7EF9');
    root.style.setProperty('--color-secondary', '#383838');
    root.style.setProperty('--color-tertiary', '#2a2a2a');
    root.style.setProperty('--color-border', '#222222');
    root.style.setProperty('--color-card', '#111111');
    root.style.setProperty('--color-background', '#000000');
    root.style.setProperty('--color-text-secondary', '#AAAAAA');
    root.style.setProperty('--color-text-on-primary', '#FFFFFF');

    // 状態色（ダーク）
    root.style.setProperty('--color-success', '#52c41a');
    root.style.setProperty('--color-warning', '#faad14');
    root.style.setProperty('--color-error', '#ff4d4f');
    root.style.setProperty('--color-info', '#40a9ff');

    // 背景色バリエーション（ダーク）
    root.style.setProperty('--color-surface', '#1a1a1a');
    root.style.setProperty('--color-overlay', '#2a2a2a');
    root.style.setProperty('--color-surface-alt', '#333333');
    root.style.setProperty('--color-surface-light', '#444444');

    // テキスト色バリエーション（ダーク）
    root.style.setProperty('--color-text-primary', '#FFFFFF');
    root.style.setProperty('--color-text-disabled', '#666666');
    root.style.setProperty('--color-text-muted', '#AAAAAA');
    root.style.setProperty('--color-text-inverse', '#000000');
    root.style.setProperty('--color-text-dark', '#CCCCCC');

    // ボーダー色バリエーション（ダーク）
    root.style.setProperty('--color-border-strong', '#444444');
    root.style.setProperty('--color-border-light', '#333333');
    root.style.setProperty('--color-border-medium', '#555555');

    // ボタン色（ダーク）
    root.style.setProperty('--color-button-primary', '#9E7EF9');
    root.style.setProperty('--color-button-secondary', '#555555');
    root.style.setProperty('--color-button-success', '#52c41a');
    root.style.setProperty('--color-button-warning', '#faad14');
    root.style.setProperty('--color-button-danger', '#ff4d4f');
    root.style.setProperty('--color-button-info', '#40a9ff');

    // ボタンホバー色（ダーク）
    root.style.setProperty('--color-button-primary-hover', '#b794f6');
    root.style.setProperty('--color-button-secondary-hover', '#666666');
    root.style.setProperty('--color-button-success-hover', '#73d13d');
    root.style.setProperty('--color-button-warning-hover', '#ffc53d');
    root.style.setProperty('--color-button-danger-hover', '#ff7875');
    root.style.setProperty('--color-button-info-hover', '#69c0ff');

    // ボタン無効化色（ダーク）
    root.style.setProperty('--color-button-disabled', '#434343');
    root.style.setProperty('--color-button-danger-disabled', '#5a2d2d');

    // 透明度付き色（ダーク）
    root.style.setProperty('--color-primary-alpha-20', 'rgba(158, 126, 249, 0.2)');
    root.style.setProperty('--color-primary-alpha-08', 'rgba(158, 126, 249, 0.08)');
    root.style.setProperty('--color-shadow', 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--color-shadow-strong', 'rgba(255, 255, 255, 0.15)');

    // 特殊背景色（ダーク）
    root.style.setProperty('--color-success-bg', '#162312');
    root.style.setProperty('--color-warning-bg', '#2b2111');
    root.style.setProperty('--color-error-bg', '#2a1215');
    root.style.setProperty('--color-info-bg', '#111b26');
    root.style.setProperty('--color-surface-hover', '#333333');

    // ボーダー特殊色（ダーク）
    root.style.setProperty('--color-success-border', '#52c41a');
    root.style.setProperty('--color-warning-border', '#faad14');
    root.style.setProperty('--color-error-border', '#ff4d4f');
    root.style.setProperty('--color-info-border', '#40a9ff');

    // アイコンフィルター（ダーク）
    root.style.setProperty('--icon-filter', 'invert(1) brightness(1)');

    // バナーオーバーレイ（ダーク）
    root.style.setProperty(
      '--banner-overlay-gradient',
      'linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.3) 100%)'
    );
  } else {
    // Light Theme (Purple Breeze)
    root.style.setProperty('--color-text', '#535465');
    root.style.setProperty('--color-titles', '#11142D');
    root.style.setProperty('--color-primary', '#6C5DD3');
    root.style.setProperty('--color-secondary', '#1B1D21');
    root.style.setProperty('--color-tertiary', '#B8DCE9');
    root.style.setProperty('--color-border', '#E4E4E4');
    root.style.setProperty('--color-card', '#FFFFFF');
    root.style.setProperty('--color-background', '#F6F6F8');
    root.style.setProperty('--color-text-secondary', '#7A7A85');
    root.style.setProperty('--color-text-on-primary', '#FFFFFF');

    // 状態色（ライト）
    root.style.setProperty('--color-success', '#28a745');
    root.style.setProperty('--color-warning', '#ffc107');
    root.style.setProperty('--color-error', '#dc3545');
    root.style.setProperty('--color-info', '#1890ff');

    // 背景色バリエーション（ライト）
    root.style.setProperty('--color-surface', '#f8f9fa');
    root.style.setProperty('--color-overlay', '#f9f9f9');
    root.style.setProperty('--color-surface-alt', '#f5f5f5');
    root.style.setProperty('--color-surface-light', '#fafafa');

    // テキスト色バリエーション（ライト）
    root.style.setProperty('--color-text-primary', '#535465');
    root.style.setProperty('--color-text-disabled', '#999999');
    root.style.setProperty('--color-text-muted', '#666666');
    root.style.setProperty('--color-text-inverse', '#ffffff');
    root.style.setProperty('--color-text-dark', '#333333');

    // ボーダー色バリエーション（ライト）
    root.style.setProperty('--color-border-strong', '#dddddd');
    root.style.setProperty('--color-border-light', '#eeeeee');
    root.style.setProperty('--color-border-medium', '#cccccc');

    // ボタン色（ライト）
    root.style.setProperty('--color-button-primary', '#5755d9');
    root.style.setProperty('--color-button-secondary', '#6c757d');
    root.style.setProperty('--color-button-success', '#52c41a');
    root.style.setProperty('--color-button-warning', '#ff9800');
    root.style.setProperty('--color-button-danger', '#dc3545');
    root.style.setProperty('--color-button-info', '#1890ff');

    // ボタンホバー色（ライト）
    root.style.setProperty('--color-button-primary-hover', '#4240b3');
    root.style.setProperty('--color-button-secondary-hover', '#5a6268');
    root.style.setProperty('--color-button-success-hover', '#449516');
    root.style.setProperty('--color-button-warning-hover', '#e68900');
    root.style.setProperty('--color-button-danger-hover', '#c82333');
    root.style.setProperty('--color-button-info-hover', '#0d7adb');

    // ボタン無効化色（ライト）
    root.style.setProperty('--color-button-disabled', '#cccccc');
    root.style.setProperty('--color-button-danger-disabled', '#e9acb1');

    // 透明度付き色（ライト）
    root.style.setProperty('--color-primary-alpha-20', 'rgba(108, 93, 211, 0.2)');
    root.style.setProperty('--color-primary-alpha-08', 'rgba(108, 93, 211, 0.08)');
    root.style.setProperty('--color-shadow', 'rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--color-shadow-strong', 'rgba(0, 0, 0, 0.15)');

    // 特殊背景色（ライト）
    root.style.setProperty('--color-success-bg', '#e6ffed');
    root.style.setProperty('--color-warning-bg', '#fff3cd');
    root.style.setProperty('--color-error-bg', '#ffdddd');
    root.style.setProperty('--color-info-bg', '#e6f7ff');
    root.style.setProperty('--color-surface-hover', '#eeeeee');

    // ボーダー特殊色（ライト）
    root.style.setProperty('--color-success-border', '#52c41a');
    root.style.setProperty('--color-warning-border', '#ffc107');
    root.style.setProperty('--color-error-border', '#dc3545');
    root.style.setProperty('--color-info-border', '#1890ff');

    // アイコンフィルター（ライト）
    root.style.setProperty('--icon-filter', 'none');

    // バナーオーバーレイ（ライト）
    root.style.setProperty(
      '--banner-overlay-gradient',
      'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.5) 100%)'
    );
  }
}

// アプリの初期化
onMount(() => {
  // ブラウザの自動スクロール復元を無効化（画面遷移時のリセットと競合させない）
  if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  // 初期テーマの適用
  applyTheme($currentTheme);

  // システムテーマ変更の監視
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = () => {
      if ($currentTheme === 'auto') {
        applyTheme('auto');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
  }

  // テーマストアの変更を監視
  currentTheme.subscribe((theme) => {
    applyTheme(theme);
  });
});
</script>

{#if screen === "iframe"}
  <IframeHostScreen />
{:else}
  <!-- ヘッダーバー -->
  <HeaderBar />

  <div class="app-container">
    {#if screen === "account"}
      <AccountScreen />
    {:else if screen === "key"}
      <KeyManagementScreen />
    {:else if screen === "settings"}
      <SettingsScreen />
    {/if}

    <!-- フッターメニュー -->
    <FooterMenu />
  </div>
{/if}

<style>
  .app-container {
    max-width: 800px;
    margin: 0 auto;
    padding-bottom: 64px; /* フッターの高さ分の余白を追加 */
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    line-height: 1.5;
    color: var(--color-text);
    background-color: var(--color-background);
    margin: 0;
    padding: 0;
    transition:
      color 0.3s ease,
      background-color 0.3s ease;
  }

  /* Embedded mode: the iframe is mounted inside a parent-provided modal card,
     so the body must be transparent to blend with the parent card surface. */
  :global(body.nosskey-embedded) {
    background: transparent;
  }
</style>
