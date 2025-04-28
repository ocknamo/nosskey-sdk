<script lang="ts">
  import AuthScreen from "./components/AuthScreen.svelte";
  import NostrScreen from "./components/NostrScreen.svelte";
  import FooterMenu from "./components/FooterMenu.svelte";
  import { currentScreen } from "./store/appState.js";

  let screen = $state("auth");

  // URLのハッシュからページを初期化
  function initializeFromHash() {
    const hash = window.location.hash.substring(1);
    if (hash === "/auth" || hash === "/nostr") {
      screen = hash.substring(1); // 先頭の'/'を削除
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
  {#if screen === "auth"}
    <AuthScreen />
  {:else if screen === "nostr"}
    <NostrScreen />
  {/if}

  <!-- フッターメニュー -->
  <FooterMenu />
</div>

<style>
  .app-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
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
