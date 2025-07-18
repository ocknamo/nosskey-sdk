<script lang="ts">
import { onMount } from 'svelte';
import { slide } from 'svelte/transition';
import { i18n } from '../../i18n/i18n-store.js';
import { getPWKManager } from '../../services/pwk-manager.service.js';
import { isLoggedIn, publicKey } from '../../store/app-state.js';
import ProfileEditor from '../ProfileEditor.svelte';
// biome-ignore lint: svelte
import ProfileHeader from '../ProfileHeader.svelte';
import CardSection from '../ui/CardSection.svelte';
import AuthScreen from './AuthScreen.svelte';

// Svelte v5のrunesモードに対応した記法
const login = $derived($isLoggedIn);

// 編集モードの状態
let isEditing = $state(false);
// biome-ignore lint: svelte
let profileHeaderRef = $state<ProfileHeader | null>(null);

onMount(async () => {
  console.log('AccountScreen mounted');

  // PWKManagerからインスタンスを取得
  const pwkManager = getPWKManager();

  // PWKが存在するか確認
  if (pwkManager.hasPWK()) {
    // 認証状態がfalseの場合は修正
    if (!$isLoggedIn) {
      console.log('PWKが見つかりましたが、認証状態がfalseでした。修正します。');
      try {
        // 公開鍵を取得して状態を更新
        const pubKey = await pwkManager.getPublicKey();
        publicKey.set(pubKey);
        isLoggedIn.set(true);
      } catch (error) {
        console.error('公開鍵の取得に失敗しました:', error);
      }
    }
  } else {
    // 逆に認証情報がないのに認証状態がtrueの場合も修正
    if ($isLoggedIn) {
      console.log('PWKがありませんが、認証状態がtrueでした。修正します。');
      isLoggedIn.set(false);
      publicKey.set(null);
    }
  }
});

// 認証状態の変更を記録
$effect(() => {
  console.log('認証状態が変更されました:', $isLoggedIn);
});

// 編集完了時のコールバック
function handleEditComplete() {
  isEditing = false;
  // ProfileHeaderの情報を更新
  if (profileHeaderRef) {
    profileHeaderRef.refreshProfile();
  }
}

// 編集開始
function handleEditStart() {
  isEditing = true;
}

// 編集キャンセル
function handleEditCancel() {
  isEditing = false;
}
</script>

<!-- デモアプリとドメイン変更の注意喚起セクション -->
<CardSection title={$i18n.t.appWarning.title}>
  <ul>
    <li>{$i18n.t.appWarning.demoDescription}</li>
    <li>{$i18n.t.appWarning.prfCompatibility}</li>
    <li>{$i18n.t.appWarning.domainChange}</li>
  </ul>
</CardSection>

<div class="account-screen">
  {#if !login}
    <!-- 未認証の場合、認証画面を表示 -->
    <AuthScreen />
  {:else}
    <!-- 認証済みの場合、アカウント情報を表示 -->
    <div class="account-info">
      <!-- プロフィールヘッダー -->
      <ProfileHeader
        bind:this={profileHeaderRef}
        {isEditing}
        onEdit={handleEditStart}
      />

      <!-- プロフィール編集（編集モード時のみ表示） -->
      {#if isEditing}
        <div transition:slide={{ duration: 300 }}>
          <ProfileEditor
            onSave={handleEditComplete}
            onCancel={handleEditCancel}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .account-screen {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    padding-bottom: 64px; /* フッターメニューの高さを確保 */
  }

  .account-info {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
</style>
