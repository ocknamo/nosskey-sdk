<script lang="ts">
import { completeOnTimeout, createRxBackwardReq, latest, uniq } from 'rx-nostr';
import type { NostrEvent } from '../../../../src/types.js';
import editIcon from '../assets/person_edit_24.svg';
import { i18n } from '../i18n/i18n-store.js';
import { publicKey } from '../store/app-state.js';
import { relayService } from '../store/relay-store.js';
import PublicKeyDisplay from './PublicKeyDisplay.svelte';
import IconButton from './ui/button/IconButton.svelte';

// Props
interface Props {
  isEditing: boolean;
  onEdit: () => void;
}

const { isEditing, onEdit }: Props = $props();

// プロフィール情報の状態
let displayName = $state('');
let name = $state('');
let about = $state('');
let website = $state('');
let picture = $state('');
let banner = $state('');
let isLoading = $state(false);
let imageError = $state(false);
let bannerError = $state(false);

// LocalStorageキーのプレフィックス
const STORAGE_PREFIX = 'nosskey_profile_';

// 現在の公開鍵
let currentPublicKey = $state('');

// publicKeyストアを監視
$effect(() => {
  if ($publicKey) {
    currentPublicKey = $publicKey;
    loadProfile();
  }
});

// LocalStorageからプロフィール情報を読み込む
function loadLocalProfile(): boolean {
  if (!currentPublicKey || typeof localStorage === 'undefined') {
    return false;
  }

  const profileKey = `${STORAGE_PREFIX}${currentPublicKey}`;
  const savedProfile = localStorage.getItem(profileKey);

  if (savedProfile) {
    try {
      const profile = JSON.parse(savedProfile);
      displayName = profile.displayName || '';
      name = profile.name || '';
      about = profile.about || '';
      website = profile.website || '';
      picture = profile.picture || '';
      banner = profile.banner || '';
      return true;
    } catch (e) {
      console.error('保存されたプロフィールの読み込みに失敗:', e);
    }
  }
  return false;
}

// LocalStorageにプロフィール情報を保存
function saveLocalProfile() {
  if (!currentPublicKey || typeof localStorage === 'undefined') {
    return;
  }

  const profileKey = `${STORAGE_PREFIX}${currentPublicKey}`;
  const profile = {
    displayName,
    name,
    about,
    website,
    picture,
    banner,
  };

  localStorage.setItem(profileKey, JSON.stringify(profile));
}

// プロフィールデータを読み込み
async function loadProfile() {
  if (!currentPublicKey) {
    return;
  }

  // LocalStorageから読み込み
  const hasLocalData = loadLocalProfile();

  // LocalStorageにデータがない場合のみローディング表示
  isLoading = !hasLocalData;

  try {
    const req = createRxBackwardReq();
    const receivedEvents: NostrEvent[] = [];

    const subscription = relayService
      .getRxNostr()
      .use(req)
      .pipe(uniq(), latest(), completeOnTimeout(5000))
      .subscribe({
        next: (packet) => {
          if (packet?.event) {
            receivedEvents.push(packet.event);

            try {
              if (packet.event.content) {
                const metadata = JSON.parse(packet.event.content);
                displayName = metadata.display_name || metadata.displayName || '';
                name = metadata.name || '';
                about = metadata.about || '';
                website = metadata.website || '';
                picture = metadata.picture || '';
                banner = metadata.banner || '';
              }
            } catch (e) {
              console.error('メタデータのパースに失敗:', e);
            }
          }
        },
        complete: () => {
          if (receivedEvents.length > 0) {
            saveLocalProfile();
          }
          isLoading = false;
        },
        error: (err) => {
          console.error('プロフィール取得エラー:', err);
          isLoading = false;
        },
      });

    req.emit([
      {
        kinds: [0],
        authors: [currentPublicKey],
        limit: 1,
      },
    ]);
  } catch (error) {
    console.error('プロフィール取得エラー:', error);
    isLoading = false;
  }
}

// プロフィール更新を監視（編集完了時の更新用）
export function refreshProfile() {
  loadProfile();
}

// デフォルトアバターの生成
function getDefaultAvatar() {
  const initial = displayName?.charAt(0) || name?.charAt(0) || '?';
  return initial.toUpperCase();
}

// 画像エラーハンドリング
function handleImageError() {
  imageError = true;
}

function handleBannerError() {
  bannerError = true;
}

// URLの整形
function formatWebsite(url: string) {
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}
</script>

<div class="profile-header">
  <!-- 背景部分 -->
  <div class="banner-section">
    {#if banner && !bannerError}
      <img
        src={banner}
        alt="Profile banner"
        class="banner-image"
        onerror={handleBannerError}
      />
      <div class="banner-overlay"></div>
    {:else}
      <div class="banner-gradient"></div>
    {/if}

    <!-- 編集ボタン（モバイル用位置） -->
    <div class="edit-button mobile">
      <IconButton onclick={onEdit} title={$i18n.t.common.edit}>
        <img src={editIcon} alt={$i18n.t.common.edit} />
      </IconButton>
    </div>
  </div>

  <!-- プロフィール情報部分 -->
  <div class="profile-info">
    <!-- プロフィール画像 -->
    <div class="avatar-container">
      {#if picture && !imageError}
        <img
          src={picture}
          alt={displayName || name || "Profile"}
          class="avatar"
          onerror={handleImageError}
        />
      {:else}
        <div class="avatar-default">
          {getDefaultAvatar()}
        </div>
      {/if}
    </div>

    <!-- テキスト情報 -->
    <div class="info-container">
      <div class="name-section">
        <div class="names">
          {#if isLoading}
            <div class="skeleton skeleton-name"></div>
            <div class="skeleton skeleton-username"></div>
          {:else}
            {#if displayName}
              <h1 class="display-name">{displayName}</h1>
            {/if}
            {#if name}
              <p class="username">@{name}</p>
            {/if}
          {/if}
        </div>

        <!-- 編集ボタン（デスクトップ用位置） -->
        <div class="edit-button desktop">
          <IconButton onclick={onEdit} title={$i18n.t.common.edit}>
            <img src={editIcon} alt={$i18n.t.common.edit} />
          </IconButton>
        </div>
      </div>

      {#if isLoading}
        <div class="skeleton skeleton-about"></div>
      {:else}
        {#if about}
          <p class="about">{about}</p>
        {/if}
        {#if website}
          <a
            href={formatWebsite(website)}
            target="_blank"
            rel="noopener noreferrer"
            class="website"
          >
            🌐 {website}
          </a>
        {/if}
      {/if}

      <!-- 公開鍵情報 -->
      {#if currentPublicKey}
        <div class="public-key-wrapper">
          <PublicKeyDisplay />
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .profile-header {
    background-color: var(--color-card);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px var(--color-shadow);
    margin-bottom: 20px;
  }

  /* バナーセクション */
  .banner-section {
    position: relative;
    height: 150px;
    overflow: hidden;
  }

  .banner-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--banner-overlay-gradient);
  }

  .banner-gradient {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      135deg,
      var(--color-primary),
      var(--color-primary-dark)
    );
  }

  /* 編集ボタン */
  .edit-button {
    position: absolute;
    top: 16px;
    right: 16px;
    background-color: var(--color-card);
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
  }

  .edit-button.desktop {
    display: none;
  }

  .edit-button:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .edit-button img {
    width: 24px;
    height: 24px;
    filter: var(--icon-filter);
  }
  /* プロフィール情報部分 */
  .profile-info {
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-top: -40px;
  }

  /* アバター */
  .avatar-container {
    position: relative;
    margin-bottom: 16px;
  }

  .avatar,
  .avatar-default {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 4px solid var(--color-card);
    box-shadow: 0 2px 8px var(--color-shadow);
  }

  .avatar {
    object-fit: cover;
  }

  .avatar-default {
    background-color: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: bold;
  }

  /* テキスト情報 */
  .info-container {
    width: 100%;
  }

  .name-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 12px;
  }

  .names {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .display-name {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 0;
    color: var(--color-text);
  }

  .username {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .about {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--color-text);
    margin: 0 0 12px 0;
    max-width: 500px;
    max-height: 300px;
  }

  .website {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-primary);
    text-decoration: none;
    font-size: 0.9rem;
    transition: opacity 0.2s ease;
  }

  .website:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  /* 公開鍵ラッパー */
  .public-key-wrapper {
    margin-top: 16px;
  }

  /* PublicKeyDisplayコンポーネントのスタイル調整 */
  .public-key-wrapper :global(.pubkey-container) {
    background-color: transparent;
    padding: 16px 0 0 0;
    border-radius: 0;
    margin-bottom: 0;
    border-top: 1px solid var(--color-border-light);
  }

  .public-key-wrapper :global(.pubkey-display h3) {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-muted);
    margin: 0 0 8px 0;
  }

  .public-key-wrapper :global(.pubkey-display p) {
    font-size: 0.85rem;
    color: var(--color-text);
    margin: 0 0 8px 0;
    font-family: monospace;
  }

  .public-key-wrapper :global(.npub) {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .public-key-wrapper :global(.copied-message) {
    color: var(--color-success);
    font-size: 0.75rem;
    font-weight: bold;
  }

  /* スケルトンローディング */
  .skeleton {
    background: linear-gradient(
      90deg,
      var(--color-border-light) 25%,
      var(--color-border-medium) 50%,
      var(--color-border-light) 75%
    );
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-name {
    width: 150px;
    height: 24px;
    margin-bottom: 8px;
  }

  .skeleton-username {
    width: 100px;
    height: 16px;
  }

  .skeleton-about {
    width: 80%;
    height: 60px;
    margin: 0 auto;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* タブレット以上のレスポンシブ対応 */
  @media (min-width: 768px) {
    .banner-section {
      height: 200px;
    }

    .profile-info {
      flex-direction: row;
      text-align: left;
      padding: 24px;
      margin-top: -80px;
      position: relative;
      z-index: 10;
    }

    .avatar-container {
      margin-bottom: 0;
      margin-right: 24px;
      flex-shrink: 0;
    }

    .avatar,
    .avatar-default {
      width: 120px;
      height: 120px;
    }

    .avatar-default {
      font-size: 3rem;
    }

    .info-container {
      flex: 1;
    }

    .name-section {
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
    }

    .names {
      align-items: flex-start;
    }

    .display-name {
      font-size: 2rem;
      color: var(--color-text-inverse);
      margin-bottom: 12px;
    }

    .username {
      font-size: 1rem;
    }

    .about {
      font-size: 1rem;
      max-width: none;
    }

    .edit-button.mobile {
      display: none;
    }

    .edit-button.desktop {
      display: flex;
      margin-top: 10px;
    }
  }

  /* デスクトップ */
  @media (min-width: 1024px) {
    .banner-section {
      height: 250px;
    }

    .display-name {
      margin-bottom: 24px;
    }

    .profile-info {
      padding: 32px;
      margin-top: -100px;
    }
  }
</style>
