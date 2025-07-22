<script lang="ts">
import { bytesToHex, hexToBytes } from '../../../../../src/index.js';
import NosskeyImage from '../../assets/nosskey.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getPWKManager } from '../../services/pwk-manager.service.js';
import * as appState from '../../store/app-state.js';
import { currentScreen } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';
import FileInputButton from '../ui/button/FileInputButton.svelte';
import SecondaryButton from '../ui/button/SecondaryButton.svelte';
import SuccessButton from '../ui/button/SuccessButton.svelte';
import ToggleButton from '../ui/button/ToggleButton.svelte';

// 状態変数
let isSupported = $state(false);
let isLoading = $state(false);
let errorMessage = $state('');
let isPrfChecked = $state(false);
// biome-ignore lint: svelte
let username = $state('');
let createdCredentialId = $state(''); // 新規作成したパスキーのID
let isPasskeyCreated = $state(false); // パスキーが作成済みかどうか

// UI表示制御
// biome-ignore lint: svelte
let showAdvancedOptions = $state(false);
// biome-ignore lint: svelte
let showDeveloperSection = $state(false);
// biome-ignore lint: svelte
let showPWKTextarea = $state(false);

// PWKインポート関連の状態変数
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
  <div class="hero-section">
    <img src={NosskeyImage} alt="Nosskey hero" width="80" height="80" />
    <h1 class="screen-title">{$i18n.t.auth.title}</h1>
    <p class="subtitle">{$i18n.t.auth.subtitle}</p>
  </div>

  {#if isLoading}
    <div class="loading-section">
      <div class="loading-spinner"></div>
      <p>{$i18n.t.auth.loading}</p>
    </div>
  {:else}
    <!-- メインアクションセクション（新規ユーザー向け） -->
    <CardSection title={$i18n.t.auth.quickStartTitle}>
      <div class="quick-start-section">
        <div class="recommendation-badge new-user">
          {$i18n.t.auth.newUserRecommended}
        </div>

        <h3>{$i18n.t.auth.passkeySectionTitle}</h3>
        <p class="section-description">{$i18n.t.auth.passkeySectionDesc}</p>

        <!-- クロスデバイス認証の説明 -->
        <div class="info-box">
          <h4>{$i18n.t.auth.crossDeviceTitle}</h4>
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
          <Button onclick={createNew} disabled={isLoading} size="large">
            {$i18n.t.auth.createNew}
          </Button>
        {:else}
          <div class="success-message">
            <div class="success-icon">✅</div>
            <h4>{$i18n.t.auth.passkeyCreated}</h4>
            <p>{$i18n.t.auth.firstLogin}</p>
            <SuccessButton
              onclick={() => login(createdCredentialId)}
              disabled={isLoading}
              className="success-action-button"
            >
              {$i18n.t.auth.proceedWithLogin}
            </SuccessButton>
          </div>
        {/if}
      </div>
    </CardSection>

    <!-- 既存ユーザー向けセクション -->
    <CardSection title={$i18n.t.auth.existingUserTitle}>
      <div class="existing-user-section">
        <div class="recommendation-badge existing-user">
          {$i18n.t.auth.returningUserRecommended}
        </div>

        <h3>{$i18n.t.auth.existingPasskeyTitle}</h3>
        <p class="section-description">{$i18n.t.auth.existingPasskeyDesc}</p>

        <SecondaryButton
          onclick={loginWithExistingPasskey}
          disabled={isLoading}
          className="secondary-action-button"
        >
          {$i18n.t.auth.loginWith}
        </SecondaryButton>
      </div>
    </CardSection>

    <!-- 高度なオプション -->
    <div class="advanced-section">
      <ToggleButton
        onclick={() => (showAdvancedOptions = !showAdvancedOptions)}
        expanded={showAdvancedOptions}
        className="toggle-section-button"
      >
        {$i18n.t.auth.advancedOptionsTitle}
      </ToggleButton>

      {#if showAdvancedOptions}
        <div class="advanced-content">
          <!-- PWKインポートセクション -->
          <CardSection title={$i18n.t.auth.pwkImportTitle}>
            <div class="pwk-import-section">
              <p class="section-description">{$i18n.t.auth.pwkImportDesc}</p>

              <div class="pwk-input-container">
                <FileInputButton
                  onchange={handlePWKFileUpload}
                  accept="application/json"
                  disabled={isLoading}
                  inputId="pwk-file-input"
                >
                  {$i18n.t.auth.pwkFileSelect}
                </FileInputButton>

                <div class="divider">
                  <span>{$i18n.t.auth.orText}</span>
                </div>

                <ToggleButton
                  onclick={() => (showPWKTextarea = !showPWKTextarea)}
                  expanded={showPWKTextarea}
                  size="small"
                  className="toggle-text-input-button"
                >
                  {$i18n.t.auth.pwkDataInput}
                </ToggleButton>
              </div>

              {#if showPWKTextarea}
                <div class="pwk-textarea-container">
                  <textarea
                    bind:value={pwkTextInput}
                    placeholder={$i18n.t.auth.pwkDataPlaceholder}
                    class="pwk-textarea"
                  ></textarea>
                  <SuccessButton
                    onclick={loginWithPWKText}
                    disabled={isLoading || !pwkTextInput}
                    className="pwk-login-button"
                  >
                    {isLoading
                      ? $i18n.t.auth.pwkLoginProcessing
                      : $i18n.t.auth.pwkLoginButton}
                  </SuccessButton>
                </div>
              {/if}

              {#if pwkImportError}
                <div class="error-message">
                  {pwkImportError}
                </div>
              {/if}
            </div>
          </CardSection>

          <!-- Nostr秘密鍵インポート -->
          <CardSection title={$i18n.t.auth.importSectionTitle}>
            <div class="import-section">
              <p class="section-description">
                {$i18n.t.auth.importSectionDesc}
              </p>
              <p class="warning-text">{$i18n.t.auth.importNotImplemented}</p>
              <SecondaryButton
                onclick={() => currentScreen.set("import")}
                disabled={isLoading}
                className="import-button"
              >
                {$i18n.t.auth.importButton}
              </SecondaryButton>
            </div>
          </CardSection>

          <!-- 開発者向けセクション -->
          <div class="developer-section">
            <ToggleButton
              onclick={() => (showDeveloperSection = !showDeveloperSection)}
              expanded={showDeveloperSection}
              size="small"
              className="toggle-section-button small"
            >
              {$i18n.t.auth.developerSection}
            </ToggleButton>

            {#if showDeveloperSection}
              <CardSection title="">
                <div class="developer-content">
                  <p class="developer-description">
                    {$i18n.t.auth.prfDebugInfo}
                  </p>

                  {#if !isPrfChecked}
                    <SecondaryButton
                      onclick={checkPrfSupport}
                      size="small"
                      className="developer-action-button"
                    >
                      {$i18n.t.auth.checkPrf}
                    </SecondaryButton>
                  {:else if !isSupported}
                    <div class="error-message">
                      <h4>{$i18n.t.auth.unsupportedTitle}</h4>
                      <p>{getUnsupportedMessage()}</p>
                    </div>
                  {:else}
                    <div class="success-message small">
                      <span class="success-icon">✅</span>
                      <p>{$i18n.t.auth.prfSupportedMessage}</p>
                    </div>
                  {/if}
                </div>
              </CardSection>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if errorMessage}
    <div class="error-message main">
      <span class="error-icon">⚠️</span>
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .auth-container {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px;
    text-align: center;
  }

  /* ヒーローセクション */
  .hero-section {
    margin-bottom: 32px;
  }

  .screen-title {
    font-size: 2.2rem;
    font-weight: 700;
    margin: 16px 0 8px 0;
    color: var(--color-text-primary);
  }

  .subtitle {
    font-size: 1.1rem;
    color: var(--color-text-secondary);
    margin-bottom: 0;
    line-height: 1.5;
  }

  /* ローディングセクション */
  .loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 40px 20px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border-light);
    border-top: 3px solid var(--color-button-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* レコメンデーションバッジ */
  .recommendation-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .recommendation-badge.new-user {
    background-color: var(--color-success-bg);
    color: var(--color-button-success);
    border: 1px solid var(--color-button-success);
  }

  .recommendation-badge.existing-user {
    background-color: var(--color-info-bg);
    color: var(--color-info);
    border: 1px solid var(--color-info);
  }

  /* セクション共通 */
  .section-description {
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin-bottom: 20px;
  }

  .quick-start-section,
  .existing-user-section {
    text-align: left;
  }

  .quick-start-section h3,
  .existing-user-section h3 {
    margin: 0 0 12px 0;
    color: var(--color-text-primary);
    font-size: 1.25rem;
  }

  /* 情報ボックス */
  .info-box {
    margin: 16px 0;
    padding: 16px;
    background-color: var(--color-info-bg);
    border-left: 4px solid var(--color-info);
    border-radius: 4px;
    text-align: left;
  }

  .info-box h4 {
    margin: 0 0 8px 0;
    color: var(--color-info);
    font-size: 1rem;
  }

  .info-box p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* ユーザー名入力 */
  .username-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 20px 0;
    text-align: left;
  }

  .username-input label {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .username-input input {
    padding: 12px;
    border-radius: 6px;
    border: 2px solid var(--color-border-medium);
    font-size: 1rem;
    transition: border-color 0.2s ease;
  }

  .username-input input:focus {
    outline: none;
    border-color: var(--color-button-primary);
  }

  /* 成功メッセージ */
  .success-message {
    padding: 20px;
    background-color: var(--color-success-bg);
    border: 2px solid var(--color-button-success);
    border-radius: 8px;
    text-align: center;
    margin: 16px 0;
  }

  .success-message.small {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    text-align: left;
  }

  .success-message h4 {
    color: var(--color-button-success);
    margin: 8px 0;
    font-size: 1.1rem;
  }

  .success-message p {
    margin: 8px 0 16px 0;
    color: var(--color-text-secondary);
  }

  .success-message.small p {
    margin: 0;
  }

  .success-icon {
    font-size: 1.2rem;
  }

  /* 高度なオプションセクション */
  .advanced-section {
    margin-top: 40px;
  }

  .advanced-content {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* PWKインポートセクション */
  .pwk-import-section {
    text-align: left;
  }

  .pwk-input-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 16px 0;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 8px 0;
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background-color: var(--color-border-medium);
  }

  .divider span {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .pwk-textarea-container {
    margin-top: 16px;
  }

  .pwk-textarea {
    width: 100%;
    height: 120px;
    padding: 12px;
    border: 2px solid var(--color-border-medium);
    border-radius: 6px;
    font-family: ui-monospace, "Courier New", monospace;
    font-size: 0.85rem;
    resize: vertical;
    margin-bottom: 12px;
    transition: border-color 0.2s ease;
  }

  .pwk-textarea:focus {
    outline: none;
    border-color: var(--color-button-primary);
  }

  .import-section {
    text-align: left;
  }

  .warning-text {
    color: var(--color-warning);
    font-size: 0.9rem;
    font-style: italic;
    margin-bottom: 16px;
  }

  .developer-section {
    margin-top: 16px;
  }

  .developer-content {
    text-align: left;
  }

  .developer-description {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin-bottom: 16px;
  }

  .error-message {
    padding: 12px 16px;
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border: 1px solid var(--color-error);
    border-radius: 6px;
    margin: 12px 0;
    font-size: 0.9rem;
    text-align: left;
  }

  .error-message.main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 24px 0;
    text-align: center;
    justify-content: center;
  }

  .error-icon {
    font-size: 1.1rem;
  }

  @media (max-width: 480px) {
    .auth-container {
      padding: 15px 10px;
    }

    .screen-title {
      font-size: 1.8rem;
    }

    .recommendation-badge {
      font-size: 0.8rem;
      padding: 3px 10px;
    }
  }
</style>
