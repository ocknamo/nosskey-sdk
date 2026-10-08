<script lang="ts">
import { i18n } from '../i18n/i18n-store.js';
import { currentScreen, type ScreenName } from '../store/app-state.js';
import { NAV_ITEMS } from './nav-items.js';
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
    {#each NAV_ITEMS as item (item.screen)}
      <NavButton
        active={screen === item.screen}
        ariaCurrent={screen === item.screen ? "page" : undefined}
        ariaLabel={$i18n.t.navigation[item.screen]}
        onclick={() => navigateTo(item.screen)}
      >
        <div class="icon">
          <img src={item.icon} alt="" />
        </div>
        <span>{$i18n.t.navigation[item.screen]}</span>
      </NavButton>
    {/each}
  </div>
</footer>

<style>
  .footer-menu {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    /* 背面のコンテンツをうっすら透かすすりガラス風 */
    background-color: color-mix(in srgb, var(--color-card) 82%, transparent);
    -webkit-backdrop-filter: saturate(180%) blur(16px);
    backdrop-filter: saturate(180%) blur(16px);
    z-index: 100;
    border-top: var(--border-width, 1px) solid var(--color-border);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  /* 計測モード (?debug=1): console-daijin のパネルが画面下部に固定され、
     body の padding-bottom は fixed 要素を動かさないため、そのままだと
     フッターナビがパネルの下敷きになりタップできない。パネル分持ち上げる。 */
  :global(body.nosskey-debug-console) .footer-menu {
    bottom: var(--nosskey-debug-panel-height, 0px);
  }

  /* PC ではナビをヘッダー（HeaderBar）へ移すため、フッターは出さない。 */
  @media (min-width: 960px) {
    .footer-menu {
      display: none;
    }
  }

  .footer-content {
    display: flex;
    justify-content: space-around;
    max-width: 800px;
    margin: 0 auto;
  }
</style>
