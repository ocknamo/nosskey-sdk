<script>
  import { navigateTo } from '../lib/stores/app-store.js';
  import { registerDirectPrf, isSupported } from '../lib/stores/nosskey-store.js';
  import PasskeyStatus from '../lib/components/PasskeyStatus.svelte';
  
  let registering = false;
  let error = null;
  let result = null;
  
  async function handleRegister() {
    if (!$isSupported) {
      error = 'このブラウザはPasskey PRF拡張をサポートしていません。';
      return;
    }
    
    registering = true;
    error = null;
    result = null;
    
    try {
      // パスキーを登録してPRF値から直接シークレットキーを導出
      result = await registerDirectPrf();
      
      console.log('登録成功:', result);
    } catch (err) {
      console.error('登録エラー:', err);
      error = err.message || 'パスキー登録中にエラーが発生しました。';
    } finally {
      registering = false;
    }
  }
</script>

<div class="register">
  <h2>パスキー登録</h2>
  
  <p class="description">
    パスキーを作成し、PRF拡張を使用して直接Nostrシークレットキーを導出します。
    この方法では暗号化・復号処理がなく、生体認証のみでNostrが使えるようになります。
  </p>
  
  <PasskeyStatus />
  
  {#if !$isSupported}
    <div class="alert warning">
      このブラウザはPasskey PRF拡張に対応していません。別のブラウザをお試しください。
    </div>
  {:else if result}
    <div class="result">
      <h3>登録成功！</h3>
      <p>あなたの新しいNostr公開鍵:</p>
      <pre>{result.publicKey}</pre>
      
      <div class="actions">
        <button class="primary" on:click={() => navigateTo('nostr')}>
          Nostrを試す
        </button>
      </div>
    </div>
  {:else}
    <div class="registration-form">
      <button class="primary" on:click={handleRegister} disabled={registering}>
        {registering ? '処理中...' : 'パスキーを作成'}
      </button>
      
      {#if registering}
        <p class="info">
          ブラウザから表示される指示に従って、パスキーを作成してください。
        </p>
      {/if}
      
      {#if error}
        <div class="alert error">
          {error}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .register {
    padding: 1rem 0;
  }
  
  .description {
    margin-bottom: 2rem;
    line-height: 1.5;
  }
  
  .registration-form {
    margin: 2rem 0;
    text-align: center;
  }
  
  .info {
    margin-top: 1rem;
    color: #6c757d;
    font-style: italic;
  }
  
  .alert {
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }
  
  .warning {
    background-color: #fff3cd;
    color: #856404;
  }
  
  .error {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .result {
    background-color: #d4edda;
    color: #155724;
    padding: 1.5rem;
    border-radius: 4px;
    margin: 2rem 0;
  }
  
  pre {
    background-color: #f8f9fa;
    padding: 0.5rem;
    border-radius: 4px;
    overflow-x: auto;
    word-break: break-all;
    white-space: pre-wrap;
  }
  
  .actions {
    margin-top: 1.5rem;
  }
  
  .primary {
    background-color: #4361ee;
    color: white;
    border: none;
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .primary:hover:not(:disabled) {
    background-color: #3a56d4;
  }
  
  .primary:disabled {
    background-color: #9e9e9e;
    cursor: not-allowed;
  }
</style>
