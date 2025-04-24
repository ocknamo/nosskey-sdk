<script>
  import { Nosskey } from 'nosskey-sdk';
  import { onMount } from 'svelte';

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
  <h2>Nosskey SDKサンプルアプリケーション</h2>
  <p>
    このアプリケーションは、Nosskey SDKを使用してPasskeyベースのNostr鍵導出機能をデモするためのものです。
  </p>

  <div class="passkey-check">
    <h3>Passkey対応確認</h3>
    
    {#if isChecking}
      <p>ブラウザの対応状況を確認中...</p>
    {:else if isPasskeySupported}
      <p class="success">
        このブラウザはPasskeyに対応しています！
        登録またはログインして機能を試すことができます。
      </p>
      <div class="button-group">
        <a href="/register" class="button">新規登録</a>
        <a href="/login" class="button">ログイン</a>
      </div>
    {:else}
      <p class="error">
        このブラウザはPasskeyに対応していません。
        Passkey対応ブラウザ（Chrome、Firefox、Safari最新版など）を使用してください。
      </p>
    {/if}
  </div>

  <div class="about-section">
    <h3>Nosskey SDKについて</h3>
    <p>
      Nosskey SDKは、WebAuthn/Passkey技術を使用してNostr用の鍵ペアを安全に導出するためのライブラリです。
      これにより、ユーザーは生の秘密鍵を管理する必要なく、生体認証などの安全な方法でNostrアプリケーションにアクセスできます。
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
