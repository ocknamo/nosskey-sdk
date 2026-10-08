<script lang="ts">
import { hexToBytes } from 'nosskey-sdk';
import NosskeyImage from '../../assets/nosskey.svg';
import { i18n } from '../../i18n/i18n-store.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import { initAccounts } from '../../store/accounts.js';
import * as appState from '../../store/app-state.js';
import { formatAuthError } from '../../utils/auth-error.js';
import { isValidNsec, nsecToHex } from '../../utils/bech32-converter.js';
import SavedAccounts from '../SavedAccounts.svelte';
import Button from '../ui/button/Button.svelte';
import TabButton from '../ui/button/TabButton.svelte';
import HelpTip from '../ui/HelpTip.svelte';

type AuthTab = 'login' | 'register';
type CreationMethod = 'new' | 'import';

let isLoading = $state(false);
let errorMessage = $state('');
// biome-ignore lint: svelte
let username = $state('');
let activeTab = $state<AuthTab>(appState.hasLoggedInBefore() ? 'login' : 'register');
let creationMethod = $state<CreationMethod>('new');
let nsecInput = $state('');
let nsecError = $state('');
// ログイン時に鍵情報が見つからなかったパスキーの credentialId（hex）。
// 空文字なら注意カード非表示。二次導線の導出ログインで使う。
let unknownCredentialId = $state('');

const keyManager = getNosskeyManager();

async function initialize() {
  isLoading = true;
  try {
    // 一覧表示前にアカウント登録簿を初期化（既存ユーザーは current 鍵を移行）。
    initAccounts();
    if (keyManager.hasKeyInfo()) {
      const pubKey = await keyManager.getPublicKey();
      appState.publicKey.set(pubKey);
      appState.isLoggedIn.set(true);
      return;
    }
  } catch (error) {
    console.error('初期化エラー:', error);
    errorMessage = `${$i18n.t.common.errorMessages.init} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}

async function createNew() {
  isLoading = true;
  errorMessage = '';

  try {
    // createPasskey（WebAuthn create）で標準 salt の PRF が #pendingPrfByCredId に
    // キャッシュされるため、続く createNostrKey はそれを消費して 2 回目の get()（UV）を
    // 省ける。nsec インポート経路（createPasskey → importNostrKey）と対称に、create と
    // 鍵生成・ログインを 1 ボタン・1 UV に統合する。create 時に PRF を返さないブラウザでは
    // createNostrKey 内で getPrfSecret() に自動フォールバックする（その場合のみ追加 UV）。
    const newCredentialId = await keyManager.createPasskey({
      user: {
        name: username || 'user@nosskey',
        displayName: username || 'user@nosskey',
      },
    });
    const keyInfo = await keyManager.createNostrKey(newCredentialId, {
      username: username.trim() || undefined,
    });

    await appState.loginWith(keyInfo);
  } catch (error) {
    console.error('パスキー作成エラー:', error);
    errorMessage = formatAuthError(
      $i18n.t.common.errorMessages.passkeyCreation,
      $i18n.t.common.errorMessages.prfUnsupported,
      error
    );
  } finally {
    isLoading = false;
  }
}

async function importExisting() {
  isLoading = true;
  errorMessage = '';
  nsecError = '';

  const trimmed = nsecInput.trim();
  if (!isValidNsec(trimmed)) {
    nsecError = $i18n.t.auth.invalidNsec;
    isLoading = false;
    return;
  }
  const nsecHex = nsecToHex(trimmed);
  if (!nsecHex) {
    nsecError = $i18n.t.auth.invalidNsec;
    isLoading = false;
    return;
  }
  const seckey = hexToBytes(nsecHex);
  // nsecToHex は bech32 デコードと prefix チェックのみで 32B を保証しない。
  // SDK 側でも検証するが、UI レイヤで早期に弾いて分かりやすいメッセージを出す。
  if (seckey.length !== 32) {
    seckey.fill(0);
    nsecError = $i18n.t.auth.invalidNsec;
    isLoading = false;
    return;
  }

  try {
    const newCredentialId = await keyManager.createPasskey({
      user: {
        name: username || 'user@nosskey',
        displayName: username || 'user@nosskey',
      },
    });
    const keyInfo = await keyManager.importNostrKey(seckey, newCredentialId, {
      username: username.trim() || undefined,
    });

    // 二重防御: SDK 側でゼロ化済みだが UI 側のバッファ参照も明示的に消す。
    // 入力欄も即座にクリアして DOM 上に nsec を残さない。
    seckey.fill(0);
    nsecInput = '';

    await appState.loginWith(keyInfo);
  } catch (error) {
    seckey.fill(0);
    console.error('nsec インポートエラー:', error);
    errorMessage = formatAuthError(
      $i18n.t.common.errorMessages.importNsec,
      $i18n.t.common.errorMessages.prfUnsupported,
      error
    );
  } finally {
    isLoading = false;
  }
}

async function login() {
  isLoading = true;
  errorMessage = '';
  unknownCredentialId = '';

  try {
    // ログインタブ: ユーザーに既存パスキーを選択させ（resident key 前提）、返ってきた
    // credentialId に紐づく保存済み鍵を復元する。ここで createNostrKey() を呼ぶと
    // 「保存済み鍵の復元」ではなく「PRF 直接モードの鍵生成」になり、wrap モード
    // （nsec インポート）のパスキーでは必ず別 pubkey になってしまう。
    const result = await keyManager.loginWithPasskey();

    if (result.status === 'restored') {
      await appState.loginWith(result.keyInfo);
      return;
    }
    if (result.status === 'ambiguous') {
      errorMessage = $i18n.t.auth.multipleAccountsForPasskey;
      return;
    }
    // 該当なし: 黙って新しい鍵を作らず、導出ログインは二次導線としてユーザーに委ねる。
    unknownCredentialId = result.credentialId;
  } catch (error) {
    console.error('ログインエラー:', error);
    errorMessage = formatAuthError(
      $i18n.t.common.errorMessages.login,
      $i18n.t.common.errorMessages.prfUnsupported,
      error
    );
  } finally {
    isLoading = false;
  }
}

/**
 * 鍵情報が見つからなかったときの二次導線。直前の assertion で得た PRF が SDK 内部に
 * 退避されているため、通常は追加の UV なしで導出できる（TTL 超過時のみ再認証）。
 */
async function deriveFromPasskey() {
  isLoading = true;
  errorMessage = '';

  try {
    const keyInfo = await keyManager.createNostrKey(hexToBytes(unknownCredentialId));

    await appState.loginWith(keyInfo);
    // 成功後にだけ畳む。loginWith が失敗した場合はカードを残し、その場で再試行できるようにする。
    unknownCredentialId = '';
  } catch (error) {
    console.error('パスキーからの鍵導出エラー:', error);
    errorMessage = formatAuthError(
      $i18n.t.common.errorMessages.login,
      $i18n.t.common.errorMessages.prfUnsupported,
      error
    );
  } finally {
    isLoading = false;
  }
}

function selectTab(tab: AuthTab) {
  activeTab = tab;
  errorMessage = '';
  unknownCredentialId = '';
  // タブ切替でも入力途中の nsec を state/DOM に残さない（「戻る」経路と同じ破棄方針）。
  showNew();
}

function showImport() {
  creationMethod = 'import';
  errorMessage = '';
}

function showNew() {
  // 新規作成モードへ戻す共通処理（「戻る」リンク・タブ切替の双方から呼ぶ）。
  // 入力途中の nsec を state/DOM から確実に消し、秘密鍵を残さない。
  creationMethod = 'new';
  nsecInput = '';
  nsecError = '';
  errorMessage = '';
}

$effect(() => {
  initialize();
});
</script>

<div class="auth-container">
  <div class="hero-section">
    <!-- 装飾の透かし（ロゴ名は見出しで読み上げられるので代替テキストは空） -->
    <img src={NosskeyImage} alt="" aria-hidden="true" width="80" height="80" />
    <h1 class="screen-title">{$i18n.t.auth.title}</h1>
    <p class="subtitle">{$i18n.t.auth.subtitle}</p>
  </div>

  <div class="auth-main">
  {#if isLoading}
    <div class="loading-section">
      <div class="loading-spinner"></div>
      <p>{$i18n.t.auth.loading}</p>
    </div>
  {:else}
    <div class="auth-tabs">
      <TabButton
        active={activeTab === "login"}
        onclick={() => selectTab("login")}
        className="auth-tab"
      >
        {$i18n.t.auth.tabLogin}
      </TabButton>
      <TabButton
        active={activeTab === "register"}
        onclick={() => selectTab("register")}
        className="auth-tab"
      >
        {$i18n.t.auth.tabRegister}
      </TabButton>
    </div>

    {#if activeTab === "login"}
      <SavedAccounts onError={(message) => (errorMessage = message)} />
      <div class="tab-panel">
        <Button onclick={() => login()} disabled={isLoading} size="large">
          {$i18n.t.auth.loginWith}
        </Button>

        {#if unknownCredentialId}
          <div class="no-key-notice" role="alert">
            <div class="no-key-title">
              <span class="error-icon" aria-hidden="true">⚠️</span>
              {$i18n.t.auth.noKeyInfoTitle}
            </div>
            <p class="no-key-description">{$i18n.t.auth.noKeyInfoDescription}</p>
            <div class="method-link-row">
              <button
                type="button"
                class="method-link method-link--forward"
                onclick={deriveFromPasskey}
                disabled={isLoading}
              >
                {$i18n.t.auth.deriveFromPasskey}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="tab-panel">
        <div class="username-input">
          <div class="username-label-row">
            <label for="username">{$i18n.t.auth.username}</label>
            <HelpTip text={$i18n.t.auth.usernameTip} placement="start" />
          </div>
          <input
            id="username"
            type="text"
            bind:value={username}
            placeholder={$i18n.t.auth.usernamePlaceholder}
            disabled={isLoading}
          />
        </div>

        {#if creationMethod === "new"}
          <Button onclick={createNew} disabled={isLoading} size="large">
            {$i18n.t.auth.createNew}
          </Button>
          <div class="method-link-row">
            <button
              type="button"
              class="method-link method-link--forward"
              onclick={showImport}
              disabled={isLoading}
            >
              {$i18n.t.auth.methodImport}
            </button>
          </div>
        {:else}
          <div class="nsec-input">
            <div class="nsec-label-row">
              <label for="nsec">{$i18n.t.auth.nsecLabel}</label>
              <HelpTip text={$i18n.t.auth.nsecTip} placement="start" />
            </div>
            <input
              id="nsec"
              type="password"
              autocomplete="off"
              spellcheck="false"
              bind:value={nsecInput}
              placeholder={$i18n.t.auth.nsecPlaceholder}
              disabled={isLoading}
            />
            {#if nsecError}
              <div class="error-message">{nsecError}</div>
            {/if}
          </div>
          <Button
            onclick={importExisting}
            disabled={isLoading || !nsecInput.trim()}
            size="large"
          >
            {$i18n.t.auth.importNsec}
          </Button>
          <div class="method-link-row">
            <button
              type="button"
              class="method-link"
              onclick={showNew}
              disabled={isLoading}
            >
              {$i18n.t.common.back}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  {#if errorMessage}
    <div class="error-message main">
      <span class="error-icon">⚠️</span>
      {errorMessage}
    </div>
  {/if}
  </div>
</div>

<style>
  /* タイポグラフィ主体のレイアウト: 大きな見出しとフォームを左寄せで縦に並べ、
     ロゴは右側に大きな透かしとして置く。 */
  .auth-container {
    position: relative;
    /* 透かしロゴ（z-index: -1）をこの要素の背面・ページ背景の前面に収める */
    isolation: isolate;
    /* 透かしロゴが右へはみ出しても横スクロールを出さない（縦方向は HelpTip 等のため可視のまま） */
    overflow-x: clip;
    margin: 0;
    padding: 24px 0 0;
    text-align: left;
  }

  .hero-section {
    margin-bottom: 32px;
  }

  /* ロゴは装飾の透かしとして右上に大きく敷く */
  .hero-section img {
    position: absolute;
    top: -8px;
    right: -16px;
    width: 200px;
    height: 200px;
    border-radius: 48px;
    opacity: 0.07;
    pointer-events: none;
    user-select: none;
    z-index: -1;
  }

  .screen-title {
    font-size: 3.2rem;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.05em;
    margin: 24px 0 12px;
    text-align: left;
    color: var(--color-text-primary);
  }

  .subtitle {
    font-size: 1.15rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.5;
    text-align: left;
  }

  .auth-main {
    max-width: 420px;
  }

  @media (min-width: 960px) {
    .auth-container {
      padding: 48px 0 0;
    }

    .hero-section {
      margin-bottom: 40px;
    }

    .hero-section img {
      top: 32px;
      right: 40px;
      width: 440px;
      height: 440px;
      border-radius: 96px;
    }

    .screen-title {
      font-size: 6rem;
    }

    .subtitle {
      font-size: 1.6rem;
    }
  }

  .loading-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
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

  /* 下線タブ */
  .auth-tabs {
    display: flex;
    gap: 24px;
    border-bottom: 1px solid var(--color-border);
    margin: 0 0 40px;
  }

  /* 項目の間をたっぷり空け、ボタンは左寄せ・内容幅 */
  .tab-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 40px;
    text-align: left;
  }

  .tab-panel > :global(*) {
    margin: 0;
  }

  /* 入力欄・注意カードは列の幅いっぱいに広げる */
  .tab-panel > .username-input,
  .tab-panel > .nsec-input,
  .tab-panel > .no-key-notice {
    align-self: stretch;
  }

  /* 主ボタンは左寄せのピル型（Button 側のサイズ指定より詳細度を上げて上書き） */
  .tab-panel > :global(.btn.btn-large) {
    width: auto;
    max-width: none;
    border-radius: 999px;
    padding: 18px 48px;
  }

  .method-link-row {
    text-align: left;
  }

  /* 主ボタン直後の補助リンクは、ボタンとひとまとまりに見えるよう少し寄せる */
  .tab-panel > .method-link-row {
    margin-top: -16px;
  }

  .no-key-notice .method-link-row {
    margin-top: 12px;
  }

  @media (max-width: 600px) {
    .auth-tabs {
      margin-bottom: 32px;
    }

    .tab-panel {
      gap: 32px;
    }

    .tab-panel > .method-link-row {
      margin-top: -12px;
    }
  }

  /* 鍵情報が見つからなかったときの注意カード。導出ログインは事故（別アカウント生成）を
     招きうるため、主ボタンより一段控えめな見た目にして意図的な操作にとどめる。 */
  .no-key-notice {
    padding: 16px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background-color: var(--color-surface);
    text-align: left;
  }

  .no-key-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .no-key-description {
    margin: 8px 0 0 0;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .method-link {
    background: none;
    border: none;
    padding: 4px;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    text-decoration: underline;
    cursor: pointer;
  }

  .method-link:hover:not(:disabled) {
    color: var(--color-text-primary);
  }

  /* 次の手順へ進むリンクは下線なしのアクセント色 + 矢印 */
  .method-link--forward {
    padding: 0;
    color: var(--color-primary);
    font-weight: 600;
    text-decoration: none;
  }

  .method-link--forward::after {
    content: " →";
  }

  .method-link--forward:hover:not(:disabled) {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .method-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nsec-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 20px 0;
    text-align: left;
  }

  .nsec-label-row {
    display: flex;
    align-items: center;
  }

  .nsec-label-row label {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .nsec-input input {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--color-border-strong);
    font-size: 1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    transition: border-color 0.2s ease;
  }

  .nsec-input input:focus {
    outline: none;
    border-color: var(--color-button-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
  }

  .username-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 20px 0;
    text-align: left;
  }

  .username-label-row {
    display: flex;
    align-items: center;
  }

  .username-label-row label {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .username-input input {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--color-border-strong);
    font-size: 1rem;
    transition: border-color 0.2s ease;
  }

  .username-input input:focus {
    outline: none;
    border-color: var(--color-button-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
  }

  .error-message {
    padding: 12px 16px;
    background-color: var(--color-error-bg);
    color: var(--color-error);
    border: 1px solid var(--color-error-border);
    border-radius: 12px;
    margin: 12px 0;
    font-size: 0.9rem;
    text-align: left;
  }

  .error-message.main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 32px 0 0;
  }

  .error-icon {
    font-size: 1.1rem;
  }

</style>
