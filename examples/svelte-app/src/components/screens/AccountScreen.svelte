<script lang="ts">
import { onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import { isLoggedIn, publicKey } from '../../store/app-state.js';
import PublicKeyDisplay from '../PublicKeyDisplay.svelte';
import AuthScreen from './AuthScreen.svelte';

const login = $derived($isLoggedIn);

onMount(async () => {
  const keyManager = getNosskeyManager();

  if (keyManager.hasKeyInfo()) {
    if (!$isLoggedIn) {
      try {
        const pubKey = await keyManager.getPublicKey();
        publicKey.set(pubKey);
        isLoggedIn.set(true);
      } catch (error) {
        console.error('公開鍵の取得に失敗しました:', error);
      }
    }
  } else if ($isLoggedIn) {
    isLoggedIn.set(false);
    publicKey.set(null);
  }
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
