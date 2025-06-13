<script lang="ts">
import AccountIcon from '../assets/account-icon.svg';
import HomeIcon from '../assets/home-icon.svg';
import SettingIcon from '../assets/setting-icon.svg';
import { i18n } from '../i18n/i18n-store.js';
import { type ScreenName, currentScreen } from '../store/app-state.js';

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

<footer class="footer-menu" role="navigation" aria-label="メインナビゲーション">
  <div class="footer-content">
    <button
      class={screen === "account" ? "active" : ""}
      aria-current={screen === "account" ? "page" : undefined}
      aria-label={$i18n.t.navigation.account}
      onclick={() => navigateTo("account")}
    >
      <div class="icon">
        <img src={AccountIcon} alt="" />
      </div>
      <span>{$i18n.t.navigation.account}</span>
    </button>
    <button
      class={screen === "timeline" ? "active" : ""}
      aria-current={screen === "timeline" ? "page" : undefined}
      aria-label={$i18n.t.navigation.timeline}
      onclick={() => navigateTo("timeline")}
    >
      <div class="icon">
        <img src={HomeIcon} alt="" />
      </div>
      <span>{$i18n.t.navigation.timeline}</span>
    </button>
    <button
      class={screen === "settings" ? "active" : ""}
      aria-current={screen === "settings" ? "page" : undefined}
      aria-label={$i18n.t.navigation.settings}
      onclick={() => navigateTo("settings")}
    >
      <div class="icon">
        <img src={SettingIcon} alt="" />
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
  }

  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: none;
    border: none;
    padding: 8px 16px;
    font-size: 0.6rem;
    color: #666;
    cursor: pointer;
    flex: 1;
    border-radius: 0px;
    transition: all 0.2s ease;
    position: relative;
    outline: none;
  }

  button:hover {
    background-color: rgba(87, 85, 217, 0.08);
  }

  button.active {
    color: #5755d9;
    font-weight: bold;
    border-top: solid 1px;
  }

  button.active .icon img {
    filter: brightness(0) saturate(100%) invert(40%) sepia(93%) saturate(1352%)
      hue-rotate(228deg) brightness(99%) contrast(95%);
  }

  button:disabled {
    opacity: 0.5;
  }

  .icon {
    font-size: 1.5rem;
    margin-bottom: 4px;
  }

  .icon img {
    width: 24px;
    height: 24px;
    transition: filter 0.2s ease;
    filter: brightness(0) saturate(100%) invert(40%) sepia(0%) saturate(0%)
      hue-rotate(0deg) brightness(100%) contrast(60%);
  }
</style>
