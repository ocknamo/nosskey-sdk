<script lang="ts">
import { onMount, tick } from 'svelte';
import FooterMenu from './components/FooterMenu.svelte';
import HeaderBar from './components/HeaderBar.svelte';
import WrapKeyBackupPrompt from './components/WrapKeyBackupPrompt.svelte';
import AccountScreen from './components/screens/AccountScreen.svelte';
import IframeHostScreen from './components/screens/IframeHostScreen.svelte';
import KeyManagementScreen from './components/screens/KeyManagement.svelte';
import SettingsScreen from './components/screens/SettingsScreen.svelte';
import {
  type ThemeMode,
  currentScreen,
  currentTheme,
  isScreenName,
  restoreLoginState,
  wrapBackupPrompt,
} from './store/app-state.js';
import { THEME_PALETTES, resolveTheme } from './theme/palettes.js';

let screen = $state('account');

// URLのハッシュからページを初期化
// screen の更新は updateHash に集約するため、ここでは直接代入せず
// currentScreen.set 経由でストア → updateHash に流す。
function initializeFromHash() {
  const hash = window.location.hash.substring(1);
  const name = hash.startsWith('/') ? hash.substring(1) : hash;
  const newScreen = name || 'account';

  if (isScreenName(newScreen)) {
    currentScreen.set(newScreen);
  }
}

// ハッシュ変更時に画面を更新
function handleHashChange() {
  initializeFromHash();
}

// 画面遷移時のスクロール位置管理
// 画面ごとにスクロール位置を Map に保存し、戻ってきたときに復元する。
// （popstate 検出はブラウザ差異が大きいため使わない）
const savedScrollPositions = new Map<string, number>();

function getScrollY(): number {
  return (
    window.scrollY ||
    document.scrollingElement?.scrollTop ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

function setScrollY(y: number) {
  window.scrollTo(0, y);
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = y;
  }
  document.documentElement.scrollTop = y;
  document.body.scrollTop = y;
}

async function applyScrollForScreen(target: string) {
  if (typeof window === 'undefined') return;
  // Svelte の DOM 更新が反映されてからスクロール位置を適用
  await tick();
  setScrollY(savedScrollPositions.get(target) ?? 0);
}

// ストアの値が変更されたときにURLハッシュを更新
function updateHash(value: string) {
  const previousScreen = screen;
  const screenChanged = previousScreen !== value;

  if (screenChanged) {
    // 離脱直前のスクロール位置を保存
    savedScrollPositions.set(previousScreen, getScrollY());
  }

  // URLハッシュの変更によるループを防ぐ
  if (window.location.hash !== `#/${value}`) {
    window.location.hash = `#/${value}`;
  }
  screen = value;

  if (screenChanged) {
    void applyScrollForScreen(value);
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

    // コンポーネント破棄時にイベントリスナーを削除
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }
});

// ストアの監視
currentScreen.subscribe(updateHash);

// ニュートラルテーマで使う丸ゴシック (M PLUS Rounded 1c) を遅延ロードする。
// パープル系のみの利用者には不要なフォント取得を発生させないため、初回に
// ニュートラルテーマが適用されたタイミングで一度だけ <link> を注入する。
let roundedFontRequested = false;
function ensureRoundedFontLoaded() {
  if (roundedFontRequested || typeof document === 'undefined') return;
  roundedFontRequested = true;

  const preconnectGstatic = document.createElement('link');
  preconnectGstatic.rel = 'preconnect';
  preconnectGstatic.href = 'https://fonts.gstatic.com';
  preconnectGstatic.crossOrigin = 'anonymous';

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href =
    'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700&display=swap';

  document.head.append(preconnectGstatic, stylesheet);
}

// テーマの適用
function applyTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;

  // `auto` は OS の prefers-color-scheme でパープル系 dark/light に解決する。
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = resolveTheme(theme, prefersDark);
  if (resolved === 'neutral-dark' || resolved === 'neutral-light') {
    ensureRoundedFontLoaded();
  }

  const palette = THEME_PALETTES[resolved];
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value);
  }
}

// アプリの初期化
onMount(() => {
  // スクロール位置は updateHash 内で画面ごとに管理するため、
  // ブラウザの自動スクロール復元は無効化する。
  if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  // 保存済み鍵情報からログイン状態を復元する。account 画面だけでなく key /
  // settings へ直接リロードした場合もログイン状態を反映するため、画面非依存で
  // ここで一度だけ実行する。iframe モードは IframeHostScreen が独自に
  // Storage Access ゲートを伴う初期化を行うため対象外。
  if (screen !== 'iframe') {
    void restoreLoginState();
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

  <!-- wrap モード鍵インポート直後のバックアップ推奨モーダル（iframe モード以外） -->
  {#if $wrapBackupPrompt}
    <WrapKeyBackupPrompt
      keyInfo={$wrapBackupPrompt}
      onClose={() => wrapBackupPrompt.set(null)}
    />
  {/if}
{/if}

<style>
  .app-container {
    max-width: 800px;
    margin: 0 auto;
    padding-top: 56px; /* 固定ヘッダーの高さ分の余白を追加 */
    padding-bottom: 64px; /* フッターの高さ分の余白を追加 */
  }

  :global(body) {
    font-family: var(--font-family);
    line-height: 1.5;
    color: var(--color-text);
    background-color: var(--color-background);
    margin: 0;
    padding: 0;
    /*
     * モバイルでは内部要素（ツールチップやはみ出した要素）が原因で
     * 横スクロールが発生しないよう、body レベルで横方向の overflow を抑止する。
     * `clip` は新しいスクロールコンテナを作らないため、`position: fixed` の
     * ヘッダ／フッタやモーダルの挙動に影響しない。
     */
    overflow-x: clip;
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
