<script lang="ts">
  import { currentScreen, resetState } from "../store/appState.js";

  // 現在の画面
  let screen = $state("auth");

  // ストアを監視して現在の画面を更新
  currentScreen.subscribe((value) => {
    screen = value;
  });

  // 画面遷移処理
  function navigateTo(target: string) {
    currentScreen.set(target);
  }

  // ログアウト処理
  function logout() {
    resetState();
  }
</script>

<footer class="footer-menu">
  <div class="footer-content">
    <button
      class={screen === "auth" ? "active" : ""}
      onclick={() => navigateTo("auth")}
    >
      <div class="icon">🔑</div>
      <span>認証</span>
    </button>
    <button
      class={screen === "nostr" ? "active" : ""}
      onclick={() => navigateTo("nostr")}
    >
      <div class="icon">📝</div>
      <span>投稿</span>
    </button>
    <button
      class={screen === "settings" ? "active" : ""}
      onclick={() => navigateTo("settings")}
    >
      <div class="icon">⚙️</div>
      <span>設定</span>
    </button>
    <button onclick={logout}>
      <div class="icon">🚪</div>
      <span>ログアウト</span>
    </button>
  </div>
</footer>

<style>
  .footer-menu {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #ffffff;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    z-index: 100;
  }

  .footer-content {
    display: flex;
    justify-content: space-around;
    max-width: 800px;
    margin: 0 auto;
    padding: 8px 0;
  }

  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: none;
    border: none;
    padding: 8px 16px;
    font-size: 0.8rem;
    color: #666;
    cursor: pointer;
    flex: 1;
    border-radius: 0;
  }

  button.active {
    color: #5755d9;
    font-weight: bold;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon {
    font-size: 1.5rem;
    margin-bottom: 4px;
  }

  /* モバイルデバイスでのみ表示 */
  @media (min-width: 768px) {
    .footer-menu {
      display: none;
    }
  }
</style>
