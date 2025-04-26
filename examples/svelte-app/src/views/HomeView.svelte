<script>
  import { navigateTo } from '../lib/stores/app-store.js';
  import { isSupported } from '../lib/stores/nosskey-store.js';
  import PasskeyStatus from '../lib/components/PasskeyStatus.svelte';
</script>

<div class="home">
  <h2>Nosskey Direct PRF Demo</h2>
  
  <p class="intro">
    このデモアプリケーションは、WebAuthn Passkey（パスキー）のPRF拡張を使用して
    Nostrシークレットキーを直接導出する革新的な方法を紹介します。
  </p>
  
  <div class="features">
    <div class="feature">
      <h3>🔐 安全なパスキー認証</h3>
      <p>
        パスキー（WebAuthn）の生体認証と端末認証で高いセキュリティを実現します。
        秘密鍵は端末内で安全に保管され、盗難リスクが大幅に低減します。
      </p>
    </div>
    
    <div class="feature">
      <h3>🚀 PRF値を直接鍵として利用</h3>
      <p>
        WebAuthn PRF拡張から得られる値を直接Nostrのシークレットキーとして
        使用する革新的なアプローチで、暗号化・復号の手間を省きます。
      </p>
    </div>
    
    <div class="feature">
      <h3>📱 シンプルなUX</h3>
      <p>
        複雑な秘密鍵管理を意識せず、生体認証やPINコードだけで
        Nostrを利用できる優れたユーザー体験を提供します。
      </p>
    </div>
  </div>
  
  <PasskeyStatus />
  
  {#if $isSupported}
    <div class="actions">
      <button class="primary" on:click={() => navigateTo('register')}>
        パスキーを登録する
      </button>
    </div>
  {/if}
</div>

<style>
  .home {
    padding: 1rem 0;
  }
  
  .intro {
    font-size: 1.1rem;
    line-height: 1.5;
    margin-bottom: 2rem;
  }
  
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .feature {
    background-color: #f8f9fa;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .feature h3 {
    margin-top: 0;
    font-size: 1.2rem;
    color: #4361ee;
  }
  
  .actions {
    margin-top: 2rem;
    text-align: center;
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
  
  .primary:hover {
    background-color: #3a56d4;
  }
</style>
