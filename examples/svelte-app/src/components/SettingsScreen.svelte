<script lang="ts">
  import { resetState, currentScreen } from "../store/appState.js";

  // 状態変数
  let clearResult = $state("");

  // ローカルストレージをクリアする関数
  function clearLocalStorage() {
    try {
      // 保存されたキーを削除
      localStorage.removeItem("nosskey_credential_ids");
      localStorage.removeItem("nosskey_pwk_blob");

      // メッセージを表示
      clearResult = "ローカルストレージをクリアしました";

      // アプリケーションの状態をリセット
      resetState();

      // 3秒後にメッセージをクリア
      setTimeout(() => {
        clearResult = "";
        // 認証画面に戻る
        currentScreen.set("auth");
      }, 3000);
    } catch (error) {
      clearResult = `エラー: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
</script>

<div class="settings-container">
  <h1>設定</h1>

  <div class="settings-section">
    <h2>ローカルストレージ</h2>
    <p>
      保存された認証情報をクリアします。この操作を行うと再度ログインが必要になります。
    </p>

    <button class="danger-button" onclick={clearLocalStorage}>
      認証情報をクリア
    </button>

    {#if clearResult}
      <div class="result-message">
        {clearResult}
      </div>
    {/if}
  </div>

  <div class="settings-section">
    <h2>アプリケーション情報</h2>
    <div class="info-item">
      <div class="label">バージョン:</div>
      <div class="value">0.1.0</div>
    </div>
    <div class="info-item">
      <div class="label">ビルド日時:</div>
      <div class="value">2025/04/29</div>
    </div>
  </div>
</div>

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }

  h1,
  h2 {
    margin-bottom: 15px;
  }

  .settings-section {
    background-color: #ffffff;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
  }

  p {
    margin-bottom: 15px;
    color: #666;
  }

  .danger-button {
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .danger-button:hover {
    background-color: #c82333;
  }

  .result-message {
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
    font-weight: bold;
  }

  .info-item {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .label {
    flex: 0 0 120px;
    font-weight: bold;
    color: #555;
  }

  .value {
    flex: 1;
  }
</style>
