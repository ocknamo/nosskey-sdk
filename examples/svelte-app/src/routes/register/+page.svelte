<script>
  import { Nosskey } from 'nosskey-sdk';
  import i18n from '../../lib/i18n/index.js';
  import { nosskeyInstance, userId } from '../../lib/stores/nosskey-store.js';
  
  // i18nから翻訳関数を取得
  const { t } = i18n;

  // 状態変数
  let userIdValue = '';
  let processing = false;
  let errorMessage = '';
  let successMessage = '';

  // 入力ハンドラ
  function handleInput(e) {
    userIdValue = e.target.value;
  }

  // ユーザー登録処理
  async function handleRegister() {
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
      
      const result = await nosskey.registerPasskey({
        userID: userIdValue,
        userDisplayName: userIdValue
      });
      
      if (result.success) {
        successMessage = $t('passkey_register_success');
        // 状態を更新
        userId.set(userIdValue);
        nosskeyInstance.set(nosskey);
      } else {
        errorMessage = `${$t('passkey_register_failed')}: ${result.error}`;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errorMessage = `${$t('error_occurred')}: ${errorMsg}`;
    } finally {
      processing = false;
    }
  }
</script>

<div class="card">
  <h2>{$t('register_title')}</h2>
  
  <p>
    {$t('register_description')}
  </p>
  
  <form on:submit|preventDefault={handleRegister}>
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
      {processing ? $t('processing') : $t('register_passkey')}
    </button>
  </form>
  
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
  
  {#if successMessage}
    <div class="success">
      <p>{successMessage}</p>
      <p>{$t('registration_complete')}</p>
      <a href="/login" class="button">{$t('go_to_login')}</a>
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
</style>
