<script lang="ts">
  import { i18n } from "../../i18n/i18n-store.js";
  import { getPWKManager } from "../../services/pwk-manager.service.js";
  import * as appState from "../../store/app-state.js";
  import { isValidNsec, nsecToHex } from "../../utils/bech32-converter.js";

  // 状態変数
  let secretKey = $state("");
  let isLoading = $state(false);
  let errorMessage = $state("");

  // PWKManagerのシングルトンインスタンスを取得
  const pwkManager = getPWKManager();

  // 戻るボタン処理
  function goBack() {
    appState.currentScreen.set("account");
  }

  // 秘密鍵のバリデーション（64文字の16進数文字列またはnsec形式）
  function isValidSecretKey(sk: string): boolean {
    // nsec形式チェック
    if (sk.startsWith("nsec1")) {
      return isValidNsec(sk);
    }

    // 16進数形式チェック
    return /^[0-9a-f]{64}$/i.test(sk);
  }

  // 秘密鍵をHex形式に変換
  function normalizeSecretKey(sk: string): string | null {
    // nsec形式の場合
    if (sk.startsWith("nsec1")) {
      return nsecToHex(sk);
    }

    // 既にHex形式の場合はそのまま
    return sk.toLowerCase();
  }

  // Nostr秘密鍵インポート処理
  async function importKey() {
    // 秘密鍵の簡易バリデーション
    if (!secretKey || !isValidSecretKey(secretKey)) {
      errorMessage =
        "有効な秘密鍵（64文字の16進数またはnsec形式）を入力してください";
      return;
    }

    isLoading = true;
    errorMessage = "";

    try {
      // 秘密鍵を正規化
      const normalizedKey = normalizeSecretKey(secretKey);

      if (!normalizedKey) {
        throw new Error("秘密鍵の変換に失敗しました");
      }

      // 秘密鍵を16進数文字列からバイト配列に変換
      const secretKeyBytes = new Uint8Array(
        normalizedKey
          .match(/.{1,2}/g)
          ?.map((byte) => Number.parseInt(byte, 16)) || [],
      );

      // 新しいパスキーを作成
      const newCredentialId = await pwkManager.createPasskey();

      // 既存の秘密鍵をインポート
      const pwk = await pwkManager.importNostrKey(
        secretKeyBytes,
        newCredentialId,
      );

      // SDKにPWKを設定（内部でストレージにも保存される）
      pwkManager.setCurrentPWK(pwk);

      // 公開鍵を取得して状態を更新
      const pubKey = await pwkManager.getPublicKey();
      appState.publicKey.set(pubKey);
      appState.isLoggedIn.set(true);

      // Nostr画面に遷移
      appState.currentScreen.set("timeline");
    } catch (error) {
      console.error("インポートエラー:", error);
      errorMessage = `インポートエラー: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      // 秘密鍵をメモリから消去
      secretKey = "";
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
          placeholder="nsec1... または 64文字の16進数"
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
  }

  .error-message {
    margin-top: 20px;
    padding: 10px;
    background-color: #ffdddd;
    color: #ff0000;
    border-radius: 4px;
  }
</style>
