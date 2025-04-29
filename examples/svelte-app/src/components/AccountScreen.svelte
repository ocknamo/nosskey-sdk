<script lang="ts">
import { onMount } from 'svelte';
import { i18n } from '../i18n/i18nStore.js';
import { authenticated, publicKey, pwkBlob } from '../store/appState.js';
import AuthScreen from './AuthScreen.svelte';
import ProfileEditor from './ProfileEditor.svelte';
import RelayStatus from './RelayStatus.svelte';

// Svelte v5のrunesモードに対応した記法
const isAuthenticated = $derived($authenticated);

onMount(() => {
  console.log('AccountScreen mounted');

  // 保存されているPWKBlobがあるかどうかをチェック
  const savedPwkBlob = localStorage.getItem('nosskey_pwk_blob');

  // ローカルストレージに認証情報があるのに認証状態がfalseの場合は修正
  if (savedPwkBlob && !$authenticated) {
    console.log('認証情報が見つかりましたが、認証状態がfalseでした。修正します。');
    try {
      const parsedPwkBlob = JSON.parse(savedPwkBlob);
      pwkBlob.set(parsedPwkBlob);

      // 公開鍵も設定（parsedPwkBlobに含まれている場合）
      if (parsedPwkBlob.publicKey) {
        publicKey.set(parsedPwkBlob.publicKey);
      }

      authenticated.set(true);
    } catch (error) {
      console.error('保存された認証情報の解析に失敗しました:', error);
    }
  }

  // 逆に認証情報がないのに認証状態がtrueの場合も修正
  if (!savedPwkBlob && $authenticated) {
    console.log('認証情報がありませんが、認証状態がtrueでした。修正します。');
    authenticated.set(false);
  }
});

// 認証状態の変更を記録
$effect(() => {
  console.log('認証状態が変更されました:', $authenticated);
});
</script>

<div class="account-screen">
  {#if !isAuthenticated}
    <!-- 未認証の場合、認証画面を表示 -->
    <AuthScreen />
  {:else}
    <!-- 認証済みの場合、アカウント情報を表示 -->
    <div class="account-info">
      <h1>アカウント</h1>

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
</style>
