<script lang="ts">
  import { onMount } from "svelte";
  import { i18n } from "../../i18n/i18n-store.js";
  import { getPWKManager } from "../../services/pwk-manager.service.js";
  import { isLoggedIn, publicKey } from "../../store/app-state.js";
  import AuthScreen from "./AuthScreen.svelte";
  import ProfileEditor from "../ProfileEditor.svelte";
  import RelayStatus from "../RelayStatus.svelte";

  // Svelte v5のrunesモードに対応した記法
  const login = $derived($isLoggedIn);

  onMount(async () => {
    console.log("AccountScreen mounted");

    // PWKManagerからインスタンスを取得
    const pwkManager = getPWKManager();

    // PWKが存在するか確認
    if (pwkManager.hasPWK()) {
      // 認証状態がfalseの場合は修正
      if (!$isLoggedIn) {
        console.log(
          "PWKが見つかりましたが、認証状態がfalseでした。修正します。",
        );
        try {
          // 公開鍵を取得して状態を更新
          const pubKey = await pwkManager.getPublicKey();
          publicKey.set(pubKey);
          isLoggedIn.set(true);
        } catch (error) {
          console.error("公開鍵の取得に失敗しました:", error);
        }
      }
    } else {
      // 逆に認証情報がないのに認証状態がtrueの場合も修正
      if ($isLoggedIn) {
        console.log("PWKがありませんが、認証状態がtrueでした。修正します。");
        isLoggedIn.set(false);
        publicKey.set(null);
      }
    }
  });

  // 認証状態の変更を記録
  $effect(() => {
    console.log("認証状態が変更されました:", $isLoggedIn);
  });
</script>

<!-- デモアプリとドメイン変更の注意喚起セクション -->
<div class="warning-section">
  <h2>{$i18n.t.appWarning.title}</h2>
  <p class="warning-text">{$i18n.t.appWarning.demoDescription}</p>
  <p class="warning-text">{$i18n.t.appWarning.domainChange}</p>
</div>

<div class="account-screen">
  {#if !login}
    <!-- 未認証の場合、認証画面を表示 -->
    <AuthScreen />
  {:else}
    <!-- 認証済みの場合、アカウント情報を表示 -->
    <div class="account-info">
      <h1>{$i18n.t.navigation.account}</h1>

      <!-- 公開鍵情報とリレー状態の表示 -->
      <RelayStatus />

      <!-- プロフィール編集 -->
      <ProfileEditor />
    </div>
  {/if}
</div>

<style>
  .account-screen {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 80px; /* フッターメニューの高さを確保 */
  }

  .account-info {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  h1 {
    font-size: 1.8rem;
    margin-bottom: 20px;
    text-align: center;
  }

  /* 警告セクションのスタイル */
  .warning-section {
    border-left: 4px solid #ffc107;
    background-color: #fff8e1;
    padding: 0 8px;
  }

  .warning-text {
    color: #856404;
    margin-bottom: 10px;
    line-height: 1.5;
    text-align: left;
  }
</style>
