<script lang="ts">
import { PWKManager, bytesToHex, hexToBytes } from '../../../../src/index.js';
import { i18n } from '../i18n/i18nStore.js';
import * as appState from '../store/appState.js';
import { cacheSecrets, cacheTimeout, currentScreen } from '../store/appState.js';

// 状態変数
let isSupported = $state(false);
let isLoading = $state(false);
let errorMessage = $state('');
let storedCredentialIds = $state<string[]>([]);
let isPrfChecked = $state(false);
// biome-ignore lint:
let username = $state('');
let createdCredentialId = $state(''); // 新規作成したパスキーのID
let isPasskeyCreated = $state(false); // パスキーが作成済みかどうか

// PWKManagerのインスタンスを作成（キャッシュ設定を反映）
let isCaching = false;
let timeoutSeconds = 300; // デフォルト5分（300秒）

cacheSecrets.subscribe((value) => {
  isCaching = value;
});

cacheTimeout.subscribe((value) => {
  timeoutSeconds = value;
});

const pwkManager = new PWKManager({
  cacheOptions: {
    enabled: isCaching,
    timeoutMs: timeoutSeconds * 1000, // 秒をミリ秒に変換
  },
});

// 初期化関数
async function initialize() {
  isLoading = true;
  try {
    // ローカルストレージからsavedCredentialIdsを取得（表示用）
    const savedIds = localStorage.getItem('nosskey_credential_ids');
    if (savedIds) {
      storedCredentialIds = JSON.parse(savedIds);
    }

    // ローカルストレージから保存済みのPWKBlobを取得
    const savedPwkBlob = localStorage.getItem('nosskey_pwk_blob');
    if (savedPwkBlob) {
      // PWKBlobを復元
      const parsedPwkBlob = JSON.parse(savedPwkBlob);

      // 状態を更新
      appState.pwkBlob.set(parsedPwkBlob);
      appState.publicKey.set(parsedPwkBlob.publicKey);
      appState.isLoggedIn.set(true);

      // PWKManagerのキャッシュ設定を更新
      pwkManager.setCacheOptions({
        enabled: isCaching,
        timeoutMs: timeoutSeconds * 1000, // 秒をミリ秒に変換
      });

      // PRF拡張対応確認をスキップして認証済み状態に
      appState.isLoggedIn.set(true);
      return; // 初期化処理を終了
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

// 新規パスキー作成
async function createNew() {
  isLoading = true;
  errorMessage = '';

  try {
    // 新しいパスキーを作成
    const newCredentialId = await pwkManager.createPasskey({
      user: {
        name: username || 'user@example.com',
        displayName: username || 'PWK user',
      },
    });

    createdCredentialId = bytesToHex(newCredentialId);
    isPasskeyCreated = true;
  } catch (error) {
    console.error('パスキー作成エラー:', error);
    errorMessage = `パスキー作成エラー: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

// 既存のパスキーでログイン
async function login(credentialId: string) {
  isLoading = true;
  errorMessage = '';

  try {
    // PRFを直接Nostrキーとして使用
    const result = await pwkManager.directPrfToNostrKey(hexToBytes(credentialId));

    // 状態を更新
    appState.pwkBlob.set(result);
    appState.publicKey.set(result.pubkey);
    appState.isLoggedIn.set(true);

    // PWKBlobは暗号化されているため常に保存
    const pwkBlobToSave = {
      ...result,
      publicKey: result.pubkey, // 公開鍵も一緒に保存
    };
    localStorage.setItem('nosskey_pwk_blob', JSON.stringify(pwkBlobToSave));

    // アカウント画面に遷移
    appState.currentScreen.set('account');
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
  <h1>{$i18n.t.auth.title}</h1>
  <p>{$i18n.t.auth.subtitle}</p>

  <!-- アプリ説明 -->
  <div class="app-description">
    <p>{$i18n.t.auth.appDescription}</p>
  </div>

  {#if isLoading}
    <div class="loading">{$i18n.t.auth.loading}</div>
  {:else}
    <!-- パスキー作成セクション（メイン機能） -->
    <div class="auth-section main-section">
      <h2>{$i18n.t.auth.passkeySectionTitle}</h2>
      <p>{$i18n.t.auth.passkeySectionDesc}</p>

      <!-- クロスデバイス認証の説明 -->
      <div class="info-box">
        <h3>{$i18n.t.auth.crossDeviceTitle}</h3>
        <p>{$i18n.t.auth.crossDeviceDesc}</p>
      </div>

      <div class="username-input">
        <label for="username">{$i18n.t.auth.username}</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          placeholder={$i18n.t.auth.usernamePlaceholder}
          disabled={isLoading}
        />
      </div>

      {#if !isPasskeyCreated}
        <button class="create-button" onclick={createNew} disabled={isLoading}>
          {$i18n.t.auth.createNew}
        </button>
      {:else}
        <div class="success-message">
          <h3>{$i18n.t.auth.passkeyCreated}</h3>
          <p>{$i18n.t.auth.firstLogin}</p>
          <button
            class="login-button"
            onclick={() => login(createdCredentialId)}
            disabled={isLoading}
          >
            {$i18n.t.auth.proceedWithLogin}
          </button>
        </div>
      {/if}
    </div>

    <!-- その他のログインオプション -->
    <div class="auth-section">
      <button
        class="import-button"
        onclick={() => currentScreen.set("import")}
        disabled={isLoading}>{$i18n.t.auth.importButton}</button
      >
    </div>

    <!-- 開発者向けセクション（折りたたみ可能） -->
    <details class="developer-section">
      <summary>{$i18n.t.auth.developerSection}</summary>
      <div class="auth-section developer-content">
        <p>{$i18n.t.auth.prfDebugInfo}</p>

        {#if !isPrfChecked}
          <button class="check-prf-button" onclick={checkPrfSupport}>
            {$i18n.t.auth.checkPrf}
          </button>
        {:else if !isSupported}
          <div class="error">
            <h3>{$i18n.t.auth.unsupportedTitle}</h3>
            <p>{getUnsupportedMessage()}</p>
          </div>
        {:else}
          <div class="success">
            <p>{$i18n.t.auth.prfSupportedMessage}</p>
          </div>
        {/if}
      </div>
    </details>
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

  .app-description {
    margin: 20px 0;
    font-size: 1.1rem;
    color: #666;
  }

  .auth-section {
    margin-bottom: 30px;
    padding: 20px;
    border: 1px solid #eee;
    border-radius: 8px;
    background-color: #f9f9f9;
    text-align: left;
  }

  .main-section {
    border-left: 4px solid #5755d9;
    background-color: #f8f9ff;
  }

  .info-box {
    margin: 15px 0;
    padding: 15px;
    background-color: #e6f7ff;
    border-left: 4px solid #1890ff;
    border-radius: 4px;
  }

  .developer-section {
    margin-top: 30px;
    color: #666;
    font-size: 0.9rem;
    text-align: left;
  }

  .developer-section summary {
    cursor: pointer;
    color: #888;
    padding: 10px;
    background-color: #f0f0f0;
    border-radius: 4px;
  }

  .developer-content {
    background-color: #f0f0f0;
    border-color: #ddd;
  }

  .username-input {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 15px;
  }

  .username-input input {
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #ccc;
    font-size: 1rem;
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
    width: 100%;
    margin-top: 10px;
  }

  .import-button {
    background-color: #eaeaea;
    color: #333;
    width: 100%;
    margin-bottom: 15px;
  }

  .success {
    padding: 10px;
    background-color: #e6ffed;
    border-left: 4px solid #52c41a;
    border-radius: 4px;
    margin: 10px 0;
  }

  .error-message {
    margin-top: 20px;
    padding: 10px;
    background-color: #ffdddd;
    color: #ff0000;
    border-radius: 4px;
  }

  .success-message {
    padding: 15px;
    background-color: #f0f9ff;
    border: 1px solid #d1e9ff;
    border-radius: 8px;
    text-align: center;
    margin: 15px 0;
  }

  .success-message h3 {
    color: #52c41a;
    margin-bottom: 10px;
  }

  .login-button {
    background-color: #52c41a;
    color: white;
    font-weight: bold;
    font-size: 1.1rem;
    padding: 12px 24px;
    width: 100%;
    margin-top: 15px;
  }

  @media (max-width: 480px) {
    .auth-container {
      padding: 15px 10px;
    }

    h1 {
      font-size: 1.8rem;
    }

    .auth-section {
      padding: 15px;
    }

    .create-button {
      font-size: 1.1rem;
      padding: 14px 20px;
    }
  }
</style>
