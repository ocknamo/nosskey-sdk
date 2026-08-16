<script lang="ts">
import { bytesToHex, hexToBytes } from 'nosskey-sdk';
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
// パスキーは作成できたが create 時に PRF が返らず、鍵の作成を 2 タップ目に委ねている
// 状態の credentialId（hex）。空文字なら通常の 1 タップ経路。
// 永続化しない（リロードで消える）。中断した場合の救済はログインタブの
// 「パスキーから鍵を導出」導線が担う。
let pendingCredentialId = $state('');

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

/**
 * 新しいパスキーを作成する。1 タップ目の共通前半。
 *
 * 戻り値の `pendingPrf` は「create 時に PRF が返ってきたか」。false の場合、続く
 * createNostrKey / importNostrKey は内部で navigator.credentials.get() へ
 * フォールバックするが、その get() は create の await が解けた後 ＝ ユーザージェスチャ
 * 失効後の発行になる。WebKit（iOS/macOS Safari）は WebAuthn に transient activation を
 * 要求するため NotAllowedError で落ち、「パスキーだけ作られて鍵情報が保存されない」
 * ＝ 以後ログインできない状態になる。よって false のときはここで一旦止め、
 * 2 タップ目のジェスチャ内で鍵の作成を行う。
 */
async function createPasskeyStep(mode: 'standard' | 'wrap') {
  const credentialId = await keyManager.createPasskey({
    user: {
      name: username || 'user@nosskey',
      displayName: username || 'user@nosskey',
    },
  });
  return { credentialId, pendingPrf: keyManager.hasPendingPrf(credentialId, mode) };
}

function handleCreateError(error: unknown) {
  console.error('パスキー作成エラー:', error);
  errorMessage = formatAuthError(
    $i18n.t.common.errorMessages.passkeyCreation,
    $i18n.t.common.errorMessages.prfUnsupported,
    error
  );
}

function handleImportError(error: unknown) {
  console.error('nsec インポートエラー:', error);
  errorMessage = formatAuthError(
    $i18n.t.common.errorMessages.importNsec,
    $i18n.t.common.errorMessages.prfUnsupported,
    error
  );
}

/**
 * nsec 入力欄を検証して 32B の秘密鍵バイト列にする。不正なら nsecError を立てて null を返す。
 * 1 タップ目・2 タップ目の双方から呼ぶ（nsec バッファはタップ間で保持せず、
 * 2 タップ目でも入力値から作り直す）。
 */
function parseNsecInput(): Uint8Array | null {
  const trimmed = nsecInput.trim();
  if (!isValidNsec(trimmed)) {
    nsecError = $i18n.t.auth.invalidNsec;
    return null;
  }
  const nsecHex = nsecToHex(trimmed);
  if (!nsecHex) {
    nsecError = $i18n.t.auth.invalidNsec;
    return null;
  }
  const seckey = hexToBytes(nsecHex);
  // nsecToHex は bech32 デコードと prefix チェックのみで 32B を保証しない。
  // SDK 側でも検証するが、UI レイヤで早期に弾いて分かりやすいメッセージを出す。
  if (seckey.length !== 32) {
    seckey.fill(0);
    nsecError = $i18n.t.auth.invalidNsec;
    return null;
  }
  return seckey;
}

/** 鍵生成〜ログインの共通後半（新規作成）。isLoading / エラーは呼び出し側が管理する。 */
async function completeCreateNew(credentialId: Uint8Array) {
  const keyInfo = await keyManager.createNostrKey(credentialId, {
    username: username.trim() || undefined,
  });
  await appState.loginWith(keyInfo);
  // 成功後にだけ畳む。失敗時はカードを残してその場で再試行できるようにする。
  pendingCredentialId = '';
}

/** wrap 化〜ログインの共通後半（nsec インポート）。isLoading / エラーは呼び出し側が管理する。 */
async function completeImport(seckey: Uint8Array, credentialId: Uint8Array) {
  const keyInfo = await keyManager.importNostrKey(seckey, credentialId, {
    username: username.trim() || undefined,
  });

  // 二重防御: SDK 側でゼロ化済みだが UI 側のバッファ参照も明示的に消す。
  // 入力欄も即座にクリアして DOM 上に nsec を残さない。
  seckey.fill(0);
  nsecInput = '';

  await appState.loginWith(keyInfo);
  pendingCredentialId = '';
}

async function createNew() {
  isLoading = true;
  errorMessage = '';

  try {
    // createPasskey（WebAuthn create）で標準 salt の PRF がキャッシュされていれば、
    // 続く createNostrKey はそれを消費して 2 回目の get()（UV）を省ける。
    // 返らなかった場合は 2 タップ目に委ねる（createPasskeyStep のコメント参照）。
    const { credentialId, pendingPrf } = await createPasskeyStep('standard');
    if (!pendingPrf) {
      pendingCredentialId = bytesToHex(credentialId);
      return;
    }
    await completeCreateNew(credentialId);
  } catch (error) {
    handleCreateError(error);
  } finally {
    isLoading = false;
  }
}

/** 2 タップ目（新規作成）。新しいユーザージェスチャ内で credentials.get() を発行する。 */
async function resumeCreateNew() {
  isLoading = true;
  errorMessage = '';

  try {
    await completeCreateNew(hexToBytes(pendingCredentialId));
  } catch (error) {
    handleCreateError(error);
  } finally {
    isLoading = false;
  }
}

async function importExisting() {
  isLoading = true;
  errorMessage = '';
  nsecError = '';

  const seckey = parseNsecInput();
  if (!seckey) {
    isLoading = false;
    return;
  }

  try {
    const { credentialId, pendingPrf } = await createPasskeyStep('wrap');
    if (!pendingPrf) {
      // nsec バッファはタップ間で保持しない。2 タップ目に nsecInput から作り直す。
      seckey.fill(0);
      pendingCredentialId = bytesToHex(credentialId);
      return;
    }
    await completeImport(seckey, credentialId);
  } catch (error) {
    seckey.fill(0);
    handleImportError(error);
  } finally {
    isLoading = false;
  }
}

/** 2 タップ目（nsec インポート）。新しいユーザージェスチャ内で credentials.get() を発行する。 */
async function resumeImport() {
  isLoading = true;
  errorMessage = '';
  nsecError = '';

  const seckey = parseNsecInput();
  if (!seckey) {
    isLoading = false;
    return;
  }

  try {
    await completeImport(seckey, hexToBytes(pendingCredentialId));
  } catch (error) {
    seckey.fill(0);
    handleImportError(error);
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
  // 作成方法を変えた ＝ やり直しの意思表示。作成済みパスキーの続きは破棄する
  // （そのパスキーは鍵情報なしで残るが、WebAuthn に削除 API は無い）。
  pendingCredentialId = '';
}

function showNew() {
  // 新規作成モードへ戻す共通処理（「戻る」リンク・タブ切替の双方から呼ぶ）。
  // 入力途中の nsec を state/DOM から確実に消し、秘密鍵を残さない。
  creationMethod = 'new';
  nsecInput = '';
  nsecError = '';
  errorMessage = '';
  pendingCredentialId = '';
}

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
          <div class="notice-card" role="alert">
            <div class="notice-title">
              <span class="error-icon" aria-hidden="true">⚠️</span>
              {$i18n.t.auth.noKeyInfoTitle}
            </div>
            <p class="notice-description">{$i18n.t.auth.noKeyInfoDescription}</p>
            <div class="method-link-row">
              <button
                type="button"
                class="method-link"
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
          {#if pendingCredentialId}
            <div class="notice-card second-tap" role="status">
              <div class="notice-title">{$i18n.t.auth.secondTapTitle}</div>
              <p class="notice-description">
                {$i18n.t.auth.secondTapCreateDescription}
              </p>
              <div class="second-tap-action">
                <Button
                  onclick={resumeCreateNew}
                  disabled={isLoading}
                  size="large"
                >
                  {$i18n.t.auth.secondTapAction}
                </Button>
              </div>
            </div>
          {:else}
            <Button onclick={createNew} disabled={isLoading} size="large">
              {$i18n.t.auth.createNew}
            </Button>
            <div class="method-link-row">
              <button
                type="button"
                class="method-link"
                onclick={showImport}
                disabled={isLoading}
              >
                {$i18n.t.auth.methodImport}
              </button>
            </div>
          {/if}
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
          {#if pendingCredentialId}
            <div class="notice-card second-tap" role="status">
              <div class="notice-title">{$i18n.t.auth.secondTapTitle}</div>
              <p class="notice-description">
                {$i18n.t.auth.secondTapImportDescription}
              </p>
              <div class="second-tap-action">
                <Button
                  onclick={resumeImport}
                  disabled={isLoading || !nsecInput.trim()}
                  size="large"
                >
                  {$i18n.t.auth.secondTapAction}
                </Button>
              </div>
            </div>
          {:else}
            <Button
              onclick={importExisting}
              disabled={isLoading || !nsecInput.trim()}
              size="large"
            >
              {$i18n.t.auth.importNsec}
            </Button>
          {/if}
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

<style>
  .auth-container {
    max-width: 700px;
    /* 親 .account-screen は flex column のため、cross-axis に auto margin を置くと
       free space を吸収して shrink-to-fit になる。stretch に任せるため 0 にする。 */
    margin: 0;
    padding: 20px;
    text-align: center;
  }

  @media (max-width: 600px) {
    .auth-container {
      padding: 12px 8px;
    }
  }

  .hero-section {
    margin-bottom: 32px;
  }

  .hero-section img {
    border-radius: 16px;
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
    text-align: center;
  }

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

  .auth-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background-color: var(--color-surface);
    border: var(--border-width, 1px) solid var(--color-border);
    border-radius: 10px;
    margin: 0 auto 20px;
  }

  .auth-tabs :global(.auth-tab) {
    flex: 1;
  }

  .tab-panel {
    text-align: center;
  }

  .method-link-row {
    margin-top: 16px;
    text-align: center;
  }

  /* 補足カードの共通ガワ。2 つの用途で使う:
     1. 鍵情報が見つからなかったときの注意カード。導出ログインは事故（別アカウント生成）を
        招きうるため、主ボタンより一段控えめな見た目にして意図的な操作にとどめる。
     2. 2 タップ目の案内カード（.second-tap）。こちらは異常ではなく WebKit での正規フロー
        なので、警告色・警告アイコンを使わず主ボタンを内包する。 */
  .notice-card {
    margin-top: 20px;
    padding: 16px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background-color: var(--color-surface);
    text-align: left;
  }

  .notice-card.second-tap {
    margin-top: 0;
    text-align: center;
  }

  .notice-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .notice-card.second-tap .notice-title {
    justify-content: center;
  }

  /* .notice-description は上位で text-align: left が効くため、
     中央寄せの見出し・ボタンに合わせて明示的に上書きする。 */
  .notice-card.second-tap .notice-description {
    text-align: center;
  }

  .notice-description {
    margin: 8px 0 0 0;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .second-tap-action {
    margin-top: 16px;
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
    padding: 12px;
    border-radius: 6px;
    border: 2px solid var(--color-border-medium);
    font-size: 1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    transition: border-color 0.2s ease;
  }

  .nsec-input input:focus {
    outline: none;
    border-color: var(--color-button-primary);
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
    .screen-title {
      font-size: 1.8rem;
    }
  }
</style>
