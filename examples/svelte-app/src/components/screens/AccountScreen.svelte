<script lang="ts">
import { onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { isLoggedIn, restoreLoginState } from '../../store/app-state.js';
import PublicKeyDisplay from '../PublicKeyDisplay.svelte';
import AuthScreen from './AuthScreen.svelte';

const login = $derived($isLoggedIn);

// 通常はアプリ起動時に App.svelte でログイン状態を復元済みだが、
// account 画面へ初めて遷移したときにも念のため整合させる（鍵が無いのに
// ログイン状態が残っている場合のリセットも兼ねる）。
onMount(() => {
  void restoreLoginState();
});
</script>

<!-- 主役（見出しとフォーム / 公開鍵）を先に、注意書きは控えめな一行として後ろに置く。 -->
<div class="account-screen">
  {#if !login}
    <AuthScreen />
  {:else}
    <div class="account-info">
      <PublicKeyDisplay />
    </div>
  {/if}

  <div class="warning-bar" role="note">
    <strong class="warning-bar__title">{$i18n.t.appWarning.title}</strong>
    <span class="warning-bar__text">{$i18n.t.appWarning.prfCompatibility}</span>
  </div>
</div>

<style>
  .account-screen {
    max-width: 700px;
    margin: 0 auto;
    /* フッター分の下余白は .app-container 側で確保済みなので、ここでは足さない。
       padding 20px と max-width 700px は AuthScreen.svelte の .watermark-layer（画面端までの見切れ）と
       値を合わせているので、変えるときは両方を直すこと。 */
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 40px;
    text-align: left;
  }

  @media (min-width: 960px) {
    .account-screen {
      max-width: 1120px;
      padding: 8px 88px 16px;
      gap: 48px;
    }
  }

  /* 枠で囲まず、左の縦線だけで示す控えめな注意書き。
     ログインタブなどフォームが短いとき、AuthScreen の透かし（isolation で前面側に描かれる）が
     下へはみ出して重なることがあるため、position を与えて DOM 順どおり透かしより手前に描く。 */
  .warning-bar {
    position: relative;
    max-width: 520px;
    border-left: 3px solid var(--color-warning);
    padding: 2px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.8rem;
    transition: border-color 0.3s ease;
  }

  .warning-bar__title {
    color: var(--color-warning);
  }

  .warning-bar__text {
    color: var(--color-text);
  }

  .account-info {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 24px;
  }

  @media (min-width: 960px) {
    .account-info {
      padding-top: 64px;
    }
  }
</style>
