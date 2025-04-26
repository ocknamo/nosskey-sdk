<script>
  import { navigateTo } from '../lib/stores/app-store.js';
  import { loadSavedCredentials, isAuthenticated } from '../lib/stores/nosskey-store.js';
  
  let loading = true;
  let error = null;
  
  // コンポーネントがマウントされたら保存された認証情報を読み込む
  function checkCredentials() {
    try {
      const hasCredentials = loadSavedCredentials();
      if (hasCredentials) {
        // 認証情報があれば自動ログインとみなす
        console.log('保存された認証情報を読み込みました');
      } else {
        error = '保存された認証情報がありません。先にパスキーを登録してください。';
      }
    } catch (err) {
      console.error('認証情報読み込みエラー:', err);
      error = err.message || '認証情報の読み込み中にエラーが発生しました。';
    } finally {
      loading = false;
    }
  }
  
  // コンポーネント初期化時に実行
  checkCredentials();
  
  // 認証状態が変わったらNostr画面に遷移
  $: if ($isAuthenticated) {
    navigateTo('nostr');
  }
</script>

<div class="login">
  <h2>ログイン</h2>
  
  {#if loading}
    <div class="loading">
      <p>認証情報を確認中...</p>
    </div>
  {:else if error}
    <div class="alert error">
      {error}
      <div class="actions">
        <button class="secondary" on:click={() => navigateTo('register')}>
          パスキーを登録する
        </button>
      </div>
    </div>
  {:else}
    <div class="loading">
      <p>認証情報を確認しました。Nostr画面に移動します...</p>
    </div>
  {/if}
</div>

<style>
  .login {
    padding: 1rem 0;
  }
  
  .loading {
    text-align: center;
    padding: 2rem;
    color: #6c757d;
  }
  
  .alert {
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }
  
  .error {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .actions {
    margin-top: 1.5rem;
    text-align: center;
  }
  
  .secondary {
    background-color: #6c757d;
    color: white;
    border: none;
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .secondary:hover {
    background-color: #5a6268;
  }
</style>
