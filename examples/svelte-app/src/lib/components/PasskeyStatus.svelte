<script>
  import { isSupported } from '../stores/nosskey-store.js';
</script>

<div class="passkey-status">
  <h3>Passkey PRF拡張対応状況</h3>
  
  {#if $isSupported === null}
    <p class="checking">確認中...</p>
  {:else if $isSupported}
    <p class="supported">
      <span class="icon">✓</span>
      このブラウザはPasskey PRF拡張をサポートしています！
    </p>
    <p class="info">
      パスキーを使ったNostrアカウントの作成と利用が可能です。
    </p>
  {:else}
    <p class="not-supported">
      <span class="icon">✗</span>
      このブラウザまたはデバイスはPasskey PRF拡張をサポートしていません。
    </p>
    <p class="info">
      ChromeまたはSafari最新版と、PRF拡張をサポートする認証器（YubiKeyなど）を使用してください。
    </p>
  {/if}
</div>

<style>
  .passkey-status {
    margin: 1.5rem 0;
    padding: 1rem;
    border-radius: 4px;
    background-color: #f8f9fa;
  }
  
  h3 {
    margin-top: 0;
    font-size: 1.2rem;
  }
  
  .checking {
    color: #6c757d;
  }
  
  .supported {
    color: #28a745;
    font-weight: bold;
  }
  
  .not-supported {
    color: #dc3545;
    font-weight: bold;
  }
  
  .info {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: #6c757d;
  }
  
  .icon {
    display: inline-block;
    margin-right: 0.5rem;
    font-size: 1.2rem;
  }
</style>
