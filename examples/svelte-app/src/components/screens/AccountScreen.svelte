<script lang="ts">
import { onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import { isLoggedIn, publicKey } from '../../store/app-state.js';
import PublicKeyDisplay from '../PublicKeyDisplay.svelte';
import CardSection from '../ui/CardSection.svelte';
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
  <CardSection title={$i18n.t.appWarning.title} compact>
    <p class="warning-text">{$i18n.t.appWarning.prfCompatibility}</p>
  </CardSection>

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

  .warning-text {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .account-info {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
</style>
