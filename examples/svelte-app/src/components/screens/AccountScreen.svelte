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

<div class="account-screen">
  <div class="warning-bar" role="note">
    <strong class="warning-bar__title">{$i18n.t.appWarning.title}</strong>
    <span class="warning-bar__text">{$i18n.t.appWarning.prfCompatibility}</span>
  </div>

  {#if !login}
    <AuthScreen />
  {:else}
    <div class="account-info">
      <PublicKeyDisplay />
    </div>
  {/if}
</div>

<style>
  .account-screen {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 64px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .warning-bar {
    background-color: var(--color-warning-bg);
    border: 1px solid var(--color-warning-border);
    border-left: 4px solid var(--color-warning);
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.8rem;
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
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
  }
</style>
