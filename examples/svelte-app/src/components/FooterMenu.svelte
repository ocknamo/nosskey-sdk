<script lang="ts">
import AccountIcon from '../assets/account-icon.svg';
import HomeIcon from '../assets/home-icon.svg';
import SettingIcon from '../assets/setting-icon.svg';
import { i18n } from '../i18n/i18nStore.js';
import { type ScreenName, currentScreen, resetState } from '../store/appState.js';

// 現在の画面
let screen = $state('account');

// ストアを監視して現在の画面を更新
currentScreen.subscribe((value) => {
  screen = value;
});

// 画面遷移処理
function navigateTo(target: ScreenName) {
  currentScreen.set(target);
}
</script>

<footer class="footer-menu">
  <div class="footer-content">
    <button
      class={screen === "account" ? "active" : ""}
      onclick={() => navigateTo("account")}
    >
      <div class="icon">
        <img src={AccountIcon} alt="Account" />
      </div>
      <span>{$i18n.t.navigation.account}</span>
    </button>
    <button
      class={screen === "timeline" ? "active" : ""}
      onclick={() => navigateTo("timeline")}
    >
      <div class="icon">
        <img src={HomeIcon} alt="Timeline" />
      </div>
      <span>{$i18n.t.navigation.timeline}</span>
    </button>
    <button
      class={screen === "settings" ? "active" : ""}
      onclick={() => navigateTo("settings")}
    >
      <div class="icon">
        <img src={SettingIcon} alt="Settings" />
      </div>
      <span>{$i18n.t.navigation.settings}</span>
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
</style>
