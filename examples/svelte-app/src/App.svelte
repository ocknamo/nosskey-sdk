<script lang="ts">
  import AccountScreen from "./components/AccountScreen.svelte";
  import FooterMenu from "./components/FooterMenu.svelte";
  import ImportKeyScreen from "./components/ImportKeyScreen.svelte";
  import SettingsScreen from "./components/SettingsScreen.svelte";
  import TimelineScreen from "./components/TimelineScreen.svelte";
  import { i18n } from "./i18n/i18nStore.js";
  import { currentScreen, isScreenName } from "./store/appState.js";

  let screen = $state("account");

  // URLのハッシュからページを初期化
  function initializeFromHash() {
    const hash = window.location.hash.substring(1);
    screen = hash.substring(1); // 先頭の'/'を削除

    if (isScreenName(screen)) {
      currentScreen.set(screen);
    }
  }

  // ハッシュ変更時に画面を更新
  function handleHashChange() {
    initializeFromHash();
  }

  // ストアの値が変更されたときにURLハッシュを更新
  function updateHash(value: string) {
    // URLハッシュの変更によるループを防ぐ
    if (window.location.hash !== `#/${value}`) {
      window.location.hash = `#/${value}`;
    }
    screen = value;
  }

  // 初期化とイベントリスナー設定
  $effect(() => {
    if (typeof window !== "undefined") {
      // ページ読み込み時に初期化
      initializeFromHash();

      // ハッシュの変更を監視
      window.addEventListener("hashchange", handleHashChange);

      // コンポーネント破棄時にイベントリスナーを削除
      return () => {
        window.removeEventListener("hashchange", handleHashChange);
      };
    }
  });

  // ストアの監視
  currentScreen.subscribe(updateHash);
</script>

<div class="app-container">
  {#if screen === "account"}
    <AccountScreen />
  {:else if screen === "timeline"}
    <TimelineScreen />
  {:else if screen === "settings"}
    <SettingsScreen />
  {:else if screen === "import"}
    <ImportKeyScreen />
  {/if}

  <!-- フッターメニュー -->
  <FooterMenu />
</div>

<style>
  .app-container {
    max-width: 800px;
    margin: 0 auto;
    padding-bottom: 80px; /* フッターの高さ分の余白を追加 */
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    line-height: 1.5;
    color: #333;
    background-color: #f9f9f9;
    margin: 0;
    padding: 0;
  }
</style>
