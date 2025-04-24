<script>
  import { Nosskey } from 'nosskey-sdk';
  import i18n from '../../lib/i18n/index.js';
  import { derivedKey, isAuthenticated, nosskeyInstance, userId } from '../../lib/stores/nosskey-store.js';
  
  // i18nから翻訳関数を取得
  const { t } = i18n;
  
  // 状態変数
  let userIdValue = '';
  let processing = false;
  let errorMessage = '';
  let successMessage = '';
  let publicKeyHex = '';
  
  // 入力ハンドラ
  function handleInput(e) {
    userIdValue = e.target.value;
  }
  
  // ログイン処理
  async function handleLogin() {
    if (!userIdValue.trim()) {
      errorMessage = $t('enter_user_id');
      return;
    }
    
    processing = true;
    errorMessage = '';
    successMessage = '';
    
    try {
      const nosskey = new Nosskey({
        userId: userIdValue,
        appNamespace: window.location.hostname,
        salt: 'demo-app-v1'
      });
      
      const derived = await nosskey.deriveKey();
      
      // 16進数形式の公開鍵を表示用に変換
      publicKeyHex = Nosskey.toHex(derived.pk);
      
      successMessage = $t('login_success');
      
      // 状態を更新
      userId.set(userIdValue);
      nosskeyInstance.set(nosskey);
      derivedKey.set(derived);
      isAuthenticated.set(true);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errorMessage = `${$t('error_occurred')}: ${errorMsg}`;
    } finally {
      processing = false;
    }
  }
</script>

<div class="card">
  <h2>{$t('login_title')}</h2>
  
  <p>
    {$t('login_description')}
  </p>
  
  <form on:submit|preventDefault={handleLogin}>
    <div class="form-group">
      <label for="userId">{$t('user_id')}:</label>
      <input 
        id="userId" 
        type="text" 
        value={userIdValue}
        on:input={handleInput}
        disabled={processing}
        placeholder={$t('user_id_placeholder')}
        required
      />
    </div>
    
    <button type="submit" disabled={processing}>
      {processing ? $t('processing') : $t('passkey_auth')}
    </button>
  </form>
  
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
  
  {#if successMessage}
    <div class="success">
      <p>{successMessage}</p>
      {#if publicKeyHex}
        <p>{$t('derived_pubkey')}: <code>{publicKeyHex}</code></p>
      {/if}
      <p>{$t('try_nostr_features')}</p>
      <a href="/nostr" class="button">{$t('go_to_nostr')}</a>
    </div>
  {/if}
</div>

<style>
  .form-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
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

  code {
    display: block;
    padding: 0.5rem;
    background-color: #f0f0f0;
    border-radius: 4px;
    margin: 0.5rem 0;
    word-break: break-all;
    font-family: monospace;
  }
</style>
