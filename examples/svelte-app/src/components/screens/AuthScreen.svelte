<script lang="ts">
import { bytesToHex, hexToBytes } from '../../../../../src/index.js';
import NosskeyImage from '../../assets/nosskey.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getPWKManager } from '../../services/pwk-manager.service.js';
import * as appState from '../../store/app-state.js';
import { currentScreen } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';

// 状態変数
let isSupported = $state(false);
let isLoading = $state(false);
let errorMessage = $state('');
let isPrfChecked = $state(false);
// biome-ignore lint: svelte
let username = $state('');
let createdCredentialId = $state(''); // 新規作成したパスキーのID
let isPasskeyCreated = $state(false); // パスキーが作成済みかどうか

// PWKインポート関連の状態変数
// biome-ignore lint: svelte
let showPWKTextarea = $state(false);
// biome-ignore lint: svelte
let pwkTextInput = $state('');
let pwkImportError = $state('');

// PWKManagerのシングルトンインスタンスを取得
const pwkManager = getPWKManager();

// 初期化関数
async function initialize() {
  isLoading = true;
  try {
    // PWKが存在するか確認
    if (pwkManager.hasPWK()) {
      // 公開鍵を取得して状態を更新
      const pubKey = await pwkManager.getPublicKey();
      appState.publicKey.set(pubKey);
      appState.isLoggedIn.set(true);

      // PRF拡張対応確認をスキップして認証済み状態に
      return; // 初期化処理を終了
    }
  } catch (error) {
    console.error('初期化エラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.init} ${error instanceof Error ? error.message : String(error)}`;
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
    errorMessage = `${$i18n.t.common.errorMessages.prfCheck} ${error instanceof Error ? error.message : String(error)}`;
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
        name: username || 'user@nosskey',
        displayName: username || 'user@nosskey',
      },
    });

    createdCredentialId = bytesToHex(newCredentialId);
    isPasskeyCreated = true;
  } catch (error) {
    console.error('パスキー作成エラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.passkeyCreation} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

// 特定のcredentialIdでログイン
async function login(credentialId: string) {
  isLoading = true;
  errorMessage = '';

  try {
    // PRFを直接Nostrキーとして使用
    const pwk = await pwkManager.directPrfToNostrKey(hexToBytes(credentialId));

    // SDKにPWKを設定（内部でストレージにも保存される）
    pwkManager.setCurrentPWK(pwk);

    // 公開鍵を取得して状態を更新
    const pubKey = await pwkManager.getPublicKey();
    appState.publicKey.set(pubKey);
    appState.isLoggedIn.set(true);

    // アカウント画面に遷移
    appState.currentScreen.set('account');
  } catch (error) {
    console.error('ログインエラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.login} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

// 既存のパスキーでログイン（credentialIdなし）
async function loginWithExistingPasskey() {
  isLoading = true;
  errorMessage = '';

  try {
    // PRFを直接Nostrキーとして使用（credentialIdなしで呼び出し）
    const pwk = await pwkManager.directPrfToNostrKey();

    // SDKにPWKを設定（内部でストレージにも保存される）
    pwkManager.setCurrentPWK(pwk);

    // 公開鍵を取得して状態を更新
    const pubKey = await pwkManager.getPublicKey();
    appState.publicKey.set(pubKey);
    appState.isLoggedIn.set(true);

    // アカウント画面に遷移
    appState.currentScreen.set('account');
  } catch (error) {
    console.error('ログインエラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.login} ${error instanceof Error ? error.message : String(error)}`;
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

// PWKファイルアップロードの処理
async function handlePWKFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  isLoading = true;
  pwkImportError = '';

  try {
    const fileContent = await file.text();
    await loginWithPWKData(fileContent);
  } catch (error) {
    console.error('PWKファイル読み込みエラー:', error);
    pwkImportError = `ファイル読み込みエラー: ${error instanceof Error ? error.message : String(error)}`;
    isLoading = false;
  }
}

// PWKテキストでのログイン処理
async function loginWithPWKText() {
  if (!pwkTextInput) return;

  isLoading = true;
  pwkImportError = '';

  try {
    await loginWithPWKData(pwkTextInput);
  } catch (error) {
    console.error('PWKテキスト処理エラー:', error);
    pwkImportError = `PWK処理エラー: ${error instanceof Error ? error.message : String(error)}`;
    isLoading = false;
  }
}

// PWKデータ（JSONテキスト）からのログイン処理
async function loginWithPWKData(pwkJsonText: string) {
  try {
    // JSONをパース
    const pwkData = JSON.parse(pwkJsonText);

    // PWKが有効かチェック
    if (!pwkData.v || !pwkData.alg || !pwkData.credentialId || !pwkData.pubkey) {
      throw new Error('有効なPWKデータではありません');
    }

    // PWKをセット
    pwkManager.setCurrentPWK(pwkData);

    // 公開鍵を取得して状態を更新
    const pubKey = await pwkManager.getPublicKey();
    appState.publicKey.set(pubKey);
    appState.isLoggedIn.set(true);

    // アカウント画面に遷移
    appState.currentScreen.set('account');
  } catch (error) {
    console.error('PWKログインエラー:', error);
    throw new Error(`PWKログインエラー: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isLoading = false;
  }
}

// コンポーネントのマウント時に初期化
$effect(() => {
  initialize();
});
</script>

<div class="auth-container">
  <img src={NosskeyImage} alt="Nosskey hero" width="100" height="100" />
  <h1>{$i18n.t.auth.title}</h1>
  <p>{$i18n.t.auth.subtitle}</p>

  <!-- アプリ説明 -->
  <div class="app-description">
    <p>{$i18n.t.auth.appDescription}</p>
  </div>

  {#if isLoading}
    <div class="loading">{$i18n.t.auth.loading}</div>
  {:else}
    <!-- メインセクション -->
    <CardSection title={$i18n.t.auth.accountTitle}>
      <!-- 既存パスキーでログイン -->
      <div class="login-option">
        <h3>{$i18n.t.auth.existingPasskeyTitle}</h3>
        <p>{$i18n.t.auth.existingPasskeyDesc}</p>
        <button
          class="login-with-existing-button"
          onclick={loginWithExistingPasskey}
          disabled={isLoading}
        >
          {$i18n.t.auth.loginWith}
        </button>
      </div>

      <!-- 新規パスキー作成 -->
      <div class="login-option">
        <h3>{$i18n.t.auth.passkeySectionTitle}</h3>
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
            required={true}
          />
        </div>

        {#if !isPasskeyCreated}
          <button
            class="create-button"
            onclick={createNew}
            disabled={isLoading || !username}
          >
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
    </CardSection>

    <!-- その他のログインオプション -->
    <CardSection title={$i18n.t.auth.importSectionTitle}>
      <div class="login-option">
        <h3>{$i18n.t.auth.importSectionDesc}</h3>
        <button
          class="import-button"
          onclick={() => currentScreen.set("import")}
          disabled={isLoading}>{$i18n.t.auth.importButton}</button
        >

        <div class="pwk-import-section">
          <h3>{$i18n.t.auth.pwkImportTitle}</h3>
          <p>
            {$i18n.t.auth.pwkImportDesc}
          </p>

          <div class="pwk-input-container">
            <input
              type="file"
              id="pwk-file-input"
              accept="application/json"
              onchange={handlePWKFileUpload}
              disabled={isLoading}
            />
            <label for="pwk-file-input" class="file-input-label">
              {$i18n.t.auth.pwkFileSelect}
            </label>
            <span>{$i18n.t.auth.orText}</span>
            <button
              class="pwk-textarea-toggle"
              onclick={() => (showPWKTextarea = !showPWKTextarea)}
            >
              {$i18n.t.auth.pwkDataInput}
            </button>
          </div>

          {#if showPWKTextarea}
            <div class="pwk-textarea-container">
              <textarea
                bind:value={pwkTextInput}
                placeholder={$i18n.t.auth.pwkDataPlaceholder}
                class="pwk-textarea"
              ></textarea>
              <button
                class="login-with-pwk-text-button"
                onclick={loginWithPWKText}
                disabled={isLoading || !pwkTextInput}
              >
                {isLoading
                  ? $i18n.t.auth.pwkLoginProcessing
                  : $i18n.t.auth.pwkLoginButton}
              </button>
            </div>
          {/if}

          {#if pwkImportError}
            <div class="pwk-import-error">
              {pwkImportError}
            </div>
          {/if}
        </div>
      </div>
    </CardSection>

    <!-- 開発者向けセクション（折りたたみ可能） -->
    <details class="developer-section">
      <summary>{$i18n.t.auth.developerSection}</summary>
      <CardSection title="">
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
      </CardSection>
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
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  .info-box {
    margin: 15px 0;
    padding: 15px;
    background-color: var(--color-info-bg);
    border-left: 4px solid var(--color-info);
    border-radius: 4px;
  }

  .developer-section {
    margin-top: 30px;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    text-align: left;
  }

  .developer-section summary {
    cursor: pointer;
    color: var(--color-text-secondary);
    padding: 10px;
    background-color: var(--color-surface-hover);
    border-radius: 4px;
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
    border: 1px solid var(--color-border-medium);
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

  button:disabled {
    opacity: 0.5;
  }

  .create-button {
    background-color: var(--color-button-primary);
    color: white;
    font-weight: bold;
    font-size: 1.2rem;
    padding: 16px 32px;
    width: 100%;
    margin-top: 10px;
  }

  .import-button {
    background-color: var(--color-surface-hover);
    color: var(--color-text-dark);
    width: 100%;
    margin-bottom: 15px;
  }

  .success {
    padding: 10px;
    background-color: var(--color-success-bg);
    border-left: 4px solid var(--color-button-success);
    border-radius: 4px;
    margin: 10px 0;
  }

  .error-message {
    margin-top: 20px;
    padding: 10px;
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border-radius: 4px;
  }

  .success-message {
    padding: 15px;
    background-color: var(--color-info-bg);
    border: 1px solid var(--color-info-border);
    border-radius: 8px;
    text-align: center;
    margin: 15px 0;
  }

  .success-message h3 {
    color: var(--color-button-success);
    margin-bottom: 10px;
  }

  .login-button {
    background-color: var(--color-button-success);
    color: white;
    font-weight: bold;
    font-size: 1.1rem;
    padding: 12px 24px;
    width: 100%;
    margin-top: 15px;
  }

  .login-with-existing-button {
    background-color: var(--color-info);
    color: white;
    font-weight: bold;
    font-size: 1.1rem;
    width: 100%;
    margin-top: 10px;
  }

  .login-option {
    margin-bottom: 25px;
    padding: 15px;
    border: 1px solid var(--color-surface-hover);
    border-radius: 8px;
    background-color: var(--color-surface-light);
  }

  .login-option h3 {
    margin-top: 0;
    color: var(--color-button-primary);
    margin-bottom: 10px;
  }

  /* PWKインポート関連のスタイル */
  .pwk-import-section {
    margin-top: 20px;
    padding: 15px;
    background-color: var(--color-info-bg);
    border: 1px solid var(--color-info-bg);
    border-radius: 8px;
  }

  .pwk-input-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 15px 0;
  }

  .pwk-input-container input[type="file"] {
    display: none;
  }

  .file-input-label {
    display: inline-block;
    padding: 8px 16px;
    background-color: var(--color-info);
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .pwk-textarea-toggle {
    background-color: var(--color-surface-hover);
    color: var(--color-text-dark);
    padding: 8px 16px;
    font-size: 0.9rem;
  }

  .pwk-textarea-container {
    margin-top: 15px;
  }

  .pwk-textarea {
    width: 100%;
    height: 120px;
    padding: 10px;
    border: 1px solid var(--color-border-medium);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9rem;
    resize: vertical;
    margin-bottom: 10px;
  }

  .login-with-pwk-text-button {
    background-color: var(--color-button-success);
    color: white;
    width: 100%;
  }

  .pwk-import-error {
    margin-top: 10px;
    padding: 10px;
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border-radius: 4px;
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    .auth-container {
      padding: 15px 10px;
    }

    .create-button {
      font-size: 1.1rem;
      padding: 14px 20px;
    }
  }
</style>
