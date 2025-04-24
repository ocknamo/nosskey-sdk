<script>
  import { Nosskey } from 'nosskey-sdk';
  import { derivedKey, isAuthenticated, nosskeyInstance, userId } from '../../lib/stores/nosskey-store.js';
  
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
      
      const derived = await nosskey.deriveKey();
      
      // 16進数形式の公開鍵を表示用に変換
      publicKeyHex = Nosskey.toHex(derived.pk);
      
      successMessage = 'ログインに成功しました！';
      
      // 状態を更新
      userId.set(userIdValue);
      nosskeyInstance.set(nosskey);
      derivedKey.set(derived);
      isAuthenticated.set(true);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errorMessage = `エラーが発生しました: ${errorMsg}`;
    } finally {
      processing = false;
    }
  }
</script>

<div class="card">
  <h2>Passkey認証（ログイン）</h2>
  
  <p>
    登録済みのユーザーIDを入力してPasskey認証を行います。
    認証が成功すると、Nostr機能を使用できるようになります。
  </p>
  
  <form on:submit|preventDefault={handleLogin}>
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
      {processing ? '処理中...' : 'Passkey認証'}
    </button>
  </form>
  
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
  
  {#if successMessage}
    <div class="success">
      <p>{successMessage}</p>
      {#if publicKeyHex}
        <p>導出されたノストル公開鍵: <code>{publicKeyHex}</code></p>
      {/if}
      <p>Nostr機能を使用して、メッセージを送信してみましょう。</p>
      <a href="/nostr" class="button">Nostr機能へ</a>
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
