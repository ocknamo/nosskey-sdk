<script lang="ts">
  import { hexToBytes } from '@noble/hashes/utils';
  import { PWKManager } from '../../../../src/nosskey.js';
  import * as appState from '../store/appState.js';

  // 状態変数
  let isSupported = $state(false);
  let isLoading = $state(false);
  let errorMessage = $state('');
  let storedCredentialIds = $state<string[]>([]);
  let isPrfChecked = $state(false);

  // PWKManagerのインスタンスを作成
  const pwkManager = new PWKManager();

  // 初期化関数
  async function initialize() {
    isLoading = true;
    try {
      // ローカルストレージから保存済みのcredentialIdsを取得
      const savedIds = localStorage.getItem('nosskey_credential_ids');
      if (savedIds) {
        storedCredentialIds = JSON.parse(savedIds);
      }
    } catch (error) {
      console.error('初期化エラー:', error);
      errorMessage = `初期化エラー: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }

  // PRF対応確認
  async function checkPrfSupport() {
    isLoading = true;
    errorMessage = '';
    try {
      // PRF拡張がサポートされているか確認
      isSupported = await pwkManager.isPrfSupported();
      isPrfChecked = true;
    } catch (error) {
      console.error('PRF対応確認エラー:', error);
      errorMessage = `PRF対応確認エラー: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }

  // 新規パスキー作成とNostrキー導出
  async function createNew() {
    isLoading = true;
    errorMessage = '';
    
    try {
      // 新しいパスキーを作成
      const newCredentialId = await pwkManager.createPasskey();
      
      // PRFを直接Nostrキーとして使用
      const result = await pwkManager.directPrfToNostrKey(newCredentialId);
      
      // 状態を更新
      appState.credentialId.set(result.credentialId);
      appState.pwkBlob.set(result.pwkBlob);
      appState.publicKey.set(result.publicKey);
      appState.authenticated.set(true);
      
      // ローカルストレージに保存
      const hexCredentialId = result.pwkBlob.credentialId;
      if (hexCredentialId && !storedCredentialIds.includes(hexCredentialId)) {
        storedCredentialIds = [...storedCredentialIds, hexCredentialId];
        localStorage.setItem('nosskey_credential_ids', JSON.stringify(storedCredentialIds));
      }
      
      // Nostr画面に遷移
      appState.currentScreen.set('nostr');
    } catch (error) {
      console.error('パスキー作成エラー:', error);
      errorMessage = `パスキー作成エラー: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }

  // 既存のパスキーでログイン
  async function login(credentialIdHex: string) {
    isLoading = true;
    errorMessage = '';
    
    try {
      // 16進数文字列をUint8Arrayに変換
      const rawCredentialId = hexToBytes(credentialIdHex);
      
      // PRFを直接Nostrキーとして使用
      const result = await pwkManager.directPrfToNostrKey(rawCredentialId);
      
      // 状態を更新
      appState.credentialId.set(result.credentialId);
      appState.pwkBlob.set(result.pwkBlob);
      appState.publicKey.set(result.publicKey);
      appState.authenticated.set(true);
      
      // Nostr画面に遷移
      appState.currentScreen.set('nostr');
    } catch (error) {
      console.error('ログインエラー:', error);
      errorMessage = `ログインエラー: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }

  // サポート対象外の場合のメッセージ
  function getUnsupportedMessage() {
    const isChrome = navigator.userAgent.indexOf('Chrome') > -1;
    const isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
    
    if (isChrome) {
      return 'Chrome では chrome://flags から #enable-webauthn-new-discovery-mechanism と #enable-webauthn-extensions を有効にしてください。';
    }
    
    if (isFirefox) {
      return 'Firefox では about:config から webauthn:enable_prf を true に設定してください。';
    }
    
    return 'お使いのブラウザでは WebAuthn PRF 拡張がサポートされていません。Chrome または Firefox の最新版をお試しください。';
  }

  // コンポーネントのマウント時に初期化
  $effect(() => {
    initialize();
  });
</script>

<div class="auth-container">
  <h1>Nosskey デモ</h1>
  <p>パスキー由来のNostr鍵 (PRF直接使用)</p>
  
  {#if isLoading}
    <div class="loading">ロード中...</div>
  {:else}
    <div class="auth-actions">
      {#if !isPrfChecked}
        <!-- PRF確認前の状態 -->
        <button class="check-prf-button" on:click={checkPrfSupport}>
          PRF拡張対応確認
        </button>
      {:else if !isSupported}
        <div class="error">
          <h2>PRF拡張がサポートされていません</h2>
          <p>{getUnsupportedMessage()}</p>
        </div>
      {:else}
        <button class="create-button" on:click={createNew} disabled={isLoading}>新規作成</button>
        
        {#if storedCredentialIds.length > 0}
          <div class="login-section">
            <h3>既存のパスキーでログイン</h3>
            <div class="credential-list">
              {#each storedCredentialIds as id}
                <button on:click={() => login(id)} disabled={isLoading}>
                  ログイン ({id.substring(0, 8)}...)
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
  
  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .auth-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    text-align: center;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 10px;
  }
  
  .auth-actions {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 30px;
  }
  
  button {
    padding: 12px 24px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.3s ease;
  }
  
  .create-button {
    background-color: #5755d9;
    color: white;
    font-weight: bold;
    font-size: 1.2rem;
    padding: 16px 32px;
  }
  
  .credential-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
  }
  
  .error-message {
    margin-top: 20px;
    padding: 10px;
    background-color: #ffdddd;
    color: #ff0000;
    border-radius: 4px;
  }
  
  .login-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #eee;
  }
</style>
