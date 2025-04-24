<script>
  import { Nosskey } from 'nosskey-sdk';
  import { nosskeyInstance, userId } from '../../lib/stores/nosskey-store.js';

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
      errorMessage = 'ユーザーIDを入力してください';
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
        successMessage = 'Passkeyの登録に成功しました！';
        // 状態を更新
        userId.set(userIdValue);
        nosskeyInstance.set(nosskey);
      } else {
        errorMessage = `Passkeyの登録に失敗しました: ${result.error}`;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errorMessage = `エラーが発生しました: ${errorMsg}`;
    } finally {
      processing = false;
    }
  }
</script>

<div class="card">
  <h2>Passkey新規登録</h2>
  
  <p>
    ユーザーIDを入力して、このデバイスにPasskeyを登録します。
    登録後は同じIDでログインできるようになります。
  </p>
  
  <form on:submit|preventDefault={handleRegister}>
    <div class="form-group">
      <label for="userId">ユーザーID:</label>
      <input 
        id="userId" 
        type="text" 
        value={userIdValue}
        on:input={handleInput}
        disabled={processing}
        placeholder="例: alice123"
        required
      />
    </div>
    
    <button type="submit" disabled={processing}>
      {processing ? '処理中...' : 'Passkey登録'}
    </button>
  </form>
  
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
  
  {#if successMessage}
    <div class="success">
      <p>{successMessage}</p>
      <p>登録が完了しました。ログインページへ移動して認証を行ってください。</p>
      <a href="/login" class="button">ログインページへ</a>
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
