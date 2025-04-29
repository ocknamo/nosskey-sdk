<script lang="ts">
import { PWKManager } from '../../../../src/nosskey.js';
import { i18n } from '../i18n/i18nStore.js';
import * as appState from '../store/appState.js';
import { cacheSecrets } from '../store/appState.js';

// 状態変数
let secretKey = $state('');
let isLoading = $state(false);
let errorMessage = $state('');

// PWKManagerのインスタンスを作成
const pwkManager = new PWKManager();

// 戻るボタン処理
function goBack() {
  appState.currentScreen.set('auth');
}

// 秘密鍵のバリデーション（64文字の16進数文字列）
function isValidSecretKey(sk: string): boolean {
  return /^[0-9a-f]{64}$/i.test(sk);
}

// Nostr秘密鍵インポート処理
async function importKey() {
  // 秘密鍵の簡易バリデーション
  if (!secretKey || !isValidSecretKey(secretKey)) {
    errorMessage = '有効な秘密鍵（64文字の16進数）を入力してください';
    return;
  }

  isLoading = true;
  errorMessage = '';

  try {
    // 秘密鍵を16進数文字列からバイト配列に変換
    const secretKeyBytes = new Uint8Array(
      secretKey.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || []
    );

    // 新しいパスキーを作成
    const newCredentialId = await pwkManager.createPasskey();

    // 既存の秘密鍵をインポート
    const result = await pwkManager.importNostrKey(secretKeyBytes, newCredentialId);

    // 状態を更新
    appState.credentialId.set(result.credentialId);
    appState.pwkBlob.set(result.pwkBlob);
    appState.publicKey.set(result.publicKey);
    appState.authenticated.set(true);

    // キャッシュが有効な場合のみPWKBlobをローカルストレージに保存
    let shouldCache = false;
    cacheSecrets.subscribe((value) => {
      shouldCache = value;
    });

    if (shouldCache) {
      // PWKBlobをローカルストレージに保存
      const pwkBlobToSave = {
        ...result.pwkBlob,
        publicKey: result.publicKey, // 公開鍵も一緒に保存
      };
      localStorage.setItem('nosskey_pwk_blob', JSON.stringify(pwkBlobToSave));
    }

    // ローカルストレージに保存
    const hexCredentialId = result.pwkBlob.credentialId;
    if (hexCredentialId) {
      // 既存の値を取得してマージ
      const savedIds = localStorage.getItem('nosskey_credential_ids');
      let storedCredentialIds: string[] = [];
      if (savedIds) {
        storedCredentialIds = JSON.parse(savedIds);
      }

      if (!storedCredentialIds.includes(hexCredentialId)) {
        storedCredentialIds.push(hexCredentialId);
        localStorage.setItem('nosskey_credential_ids', JSON.stringify(storedCredentialIds));
      }
    }

    // Nostr画面に遷移
    appState.currentScreen.set('nostr');
  } catch (error) {
    console.error('インポートエラー:', error);
    errorMessage = `インポートエラー: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    // 秘密鍵をメモリから消去
    secretKey = '';
    isLoading = false;
  }
}
</script>

<div class="import-container">
  <h1>{$i18n.t.auth.importTitle}</h1>
  <p>{$i18n.t.auth.importSubtitle}</p>

  {#if isLoading}
    <div class="loading">{$i18n.t.auth.loading}</div>
  {:else}
    <div class="import-form">
      <div class="form-group">
        <label for="secretKey">{$i18n.t.auth.secretKey}</label>
        <input
          id="secretKey"
          type="password"
          bind:value={secretKey}
          placeholder="64文字の16進数（例: d5b...）"
          disabled={isLoading}
        />
        <p class="help-text">{$i18n.t.auth.secretKeyHelp}</p>
      </div>

      <div class="buttons">
        <button class="back-button" onclick={goBack} disabled={isLoading}>
          {$i18n.t.common.back}
        </button>
        <button
          class="import-button"
          onclick={importKey}
          disabled={isLoading || !secretKey}
        >
          {$i18n.t.auth.importButton}
        </button>
      </div>
    </div>
  {/if}

  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .import-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    text-align: center;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 10px;
  }

  p {
    margin-bottom: 20px;
    color: #666;
  }

  .loading {
    margin: 30px 0;
    font-size: 1.2rem;
    color: #666;
  }

  .import-form {
    background-color: #f9f9f9;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    text-align: left;
  }

  .form-group {
    margin-bottom: 20px;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
  }

  input[type="password"] {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: monospace;
    font-size: 1rem;
  }

  .help-text {
    margin-top: 8px;
    font-size: 0.9rem;
    color: #666;
  }

  .buttons {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    margin-top: 25px;
  }

  button {
    flex: 1;
    padding: 12px 24px;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  .back-button {
    background-color: #6c757d;
    color: white;
  }

  .import-button {
    background-color: #5755d9;
    color: white;
    font-weight: bold;
  }

  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  .error-message {
    margin-top: 20px;
    padding: 10px;
    background-color: #ffdddd;
    color: #ff0000;
    border-radius: 4px;
  }
</style>
