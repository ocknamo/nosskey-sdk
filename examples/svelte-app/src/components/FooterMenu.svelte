<script lang="ts">
import AccountIcon from '../assets/account-icon.svg';
import HomeIcon from '../assets/home-icon.svg';
import KeyIcon from '../assets/key-icon.svg';
import SettingIcon from '../assets/setting-icon.svg';
import { i18n } from '../i18n/i18n-store.js';
import { type ScreenName, currentScreen } from '../store/app-state.js';
import NavButton from './ui/button/NavButton.svelte';

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
    <NavButton
      active={screen === "account"}
      ariaCurrent={screen === "account" ? "page" : undefined}
      ariaLabel={$i18n.t.navigation.account}
      onclick={() => navigateTo("account")}
    >
      <div class="icon">
        <img src={AccountIcon} alt="" />
      </div>
      <span>{$i18n.t.navigation.account}</span>
    </NavButton>
    <NavButton
      active={screen === "key"}
      ariaCurrent={screen === "key" ? "page" : undefined}
      ariaLabel={$i18n.t.navigation.key}
      onclick={() => navigateTo("key")}
    >
      <div class="icon">
        <img src={KeyIcon} alt="" />
      </div>
      <span>{$i18n.t.navigation.key}</span>
    </NavButton>
    <NavButton
      active={screen === "timeline"}
      ariaCurrent={screen === "timeline" ? "page" : undefined}
      ariaLabel={$i18n.t.navigation.timeline}
      onclick={() => navigateTo("timeline")}
    >
      <div class="icon">
        <img src={HomeIcon} alt="" />
      </div>
      <span>{$i18n.t.navigation.timeline}</span>
    </NavButton>
    <NavButton
      active={screen === "settings"}
      ariaCurrent={screen === "settings" ? "page" : undefined}
      ariaLabel={$i18n.t.navigation.settings}
      onclick={() => navigateTo("settings")}
    >
      <div class="icon">
        <img src={SettingIcon} alt="" />
      </div>
      <span>{$i18n.t.navigation.settings}</span>
    </NavButton>
  </div>
</footer>

<style>
  .footer-menu {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: var(--color-card);
    box-shadow: 0 -2px 10px var(--color-shadow);
    z-index: 100;
    border-top: 1px solid var(--color-border);
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  .footer-content {
    display: flex;
    justify-content: space-around;
    max-width: 800px;
    margin: 0 auto;
  }

  .icon {
    font-size: 1.5rem;
    margin-bottom: 0;
  }

  .icon img {
    width: 24px;
    height: 24px;
    transition: filter 0.2s ease;
    filter: brightness(0) saturate(100%) invert(50%) sepia(0%) saturate(0%)
      hue-rotate(0deg) brightness(100%) contrast(70%);
  }
</style>
