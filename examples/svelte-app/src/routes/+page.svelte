<script>
  import { Nosskey } from 'nosskey-sdk';
  import { onMount } from 'svelte';
  import i18n from '../lib/i18n/index.js';

  // i18nから翻訳関数を取得
  const { t } = i18n;

  let isPasskeySupported = false;
  let isChecking = true;

  onMount(async () => {
    try {
      isPasskeySupported = await Nosskey.isPasskeySupported();
    } catch (err) {
      console.error('Passkey対応確認エラー:', err);
    } finally {
      isChecking = false;
    }
  });
</script>

<div class="card">
  <h2>{$t('home_title')}</h2>
  <p>
    {$t('home_description')}
  </p>

  <div class="passkey-check">
    <h3>{$t('passkey_check_title')}</h3>
    
    {#if isChecking}
      <p>{$t('checking_browser')}</p>
    {:else if isPasskeySupported}
      <p class="success">
        {$t('passkey_supported')}
      </p>
      <div class="button-group">
        <a href="/register" class="button">{$t('register')}</a>
        <a href="/login" class="button">{$t('login')}</a>
      </div>
    {:else}
      <p class="error">
        {$t('passkey_not_supported')}
      </p>
    {/if}
  </div>

  <div class="about-section">
    <h3>{$t('about_nosskey_title')}</h3>
    <p>
      {$t('about_nosskey_description')}
    </p>
  </div>
</div>

<style>
  .passkey-check {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background-color: #f8f9fa;
    border-radius: 8px;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  .button {
    display: inline-block;
    padding: 0.5rem 1rem;
    background-color: #007bff;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-weight: bold;
  }

  .about-section {
    margin-top: 2rem;
  }
</style>
