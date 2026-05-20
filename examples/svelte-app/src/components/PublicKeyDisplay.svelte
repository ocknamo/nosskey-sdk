<script lang="ts">
import CopyIcon from '../assets/copy-icon.svg';
import { i18n } from '../i18n/i18n-store.js';
import { publicKey } from '../store/app-state.js';
import { currentProfile } from '../store/profile-store.js';
import { hexToNpub } from '../utils/bech32-converter.js';
import IconButton from './ui/button/IconButton.svelte';

// 状態変数
let publicKeyShort = $state('');
let npubAddress = $state('');
let showCopiedMessage = $state(false);
let pictureUrl = $state<string | null>(null);
let pictureBroken = $state(false);
let pubkeyInitials = $state('');

// `publicKey` / `currentProfile` は SPA ライフタイムに一致するシングルトンストアで、
// このカードは Account 画面が存在する限り常時表示されるため unsubscribe は省略する。
// （既存コードベースの subscribe パターンと揃える。短命なリストアイテム等で再利用する
// 場合は onDestroy 解除を検討すること）
let publicKeyValue = '';
publicKey.subscribe((value) => {
  publicKeyValue = value || '';

  if (publicKeyValue) {
    // 公開鍵を表示用に整形
    publicKeyShort = `${publicKeyValue.slice(0, 8)}...${publicKeyValue.slice(-8)}`;
    pubkeyInitials = publicKeyValue.slice(0, 2).toUpperCase();

    // npub形式に変換
    try {
      npubAddress = hexToNpub(publicKeyValue);
    } catch (error) {
      console.error('npub変換エラー:', error);
      npubAddress = 'Error: Could not convert to npub';
    }
  }
});

// プロフィール画像 URL の購読。pubkey 切替時にロードエラーフラグもリセットする。
currentProfile.subscribe((profile) => {
  const next = profile?.picture ?? null;
  if (next !== pictureUrl) {
    pictureBroken = false;
  }
  pictureUrl = next;
});

function handlePictureError() {
  pictureBroken = true;
}

// クリップボードにコピー
function copyNpubToClipboard() {
  if (npubAddress) {
    navigator.clipboard
      .writeText(npubAddress)
      .then(() => {
        showCopiedMessage = true;
        setTimeout(() => {
          showCopiedMessage = false;
        }, 2000);
      })
      .catch((err) => {
        console.error('クリップボードコピーエラー:', err);
      });
  }
}
</script>

<div class="pubkey-container">
  <div class="pubkey-header">
    <div class="avatar">
      {#if pictureUrl && !pictureBroken}
        <img
          src={pictureUrl}
          alt={$i18n.t.nostr.profileAvatarAlt}
          referrerpolicy="no-referrer"
          onerror={handlePictureError}
        />
      {:else}
        <span
          class="avatar-fallback"
          role="img"
          aria-label={$i18n.t.nostr.profileFallbackAlt}
        >
          {pubkeyInitials}
        </span>
      {/if}
    </div>
    <div class="pubkey-display">
      <h3>{$i18n.t.nostr.publicKey}</h3>
      <p>{publicKeyShort}</p>
      <div class="npub-container">
        <div class="npub-wrapper">
          <p class="npub">
            {npubAddress.length > 20
              ? `${npubAddress.slice(0, 12)}...${npubAddress.slice(-8)}`
              : npubAddress}
          </p>
          <IconButton
            onclick={copyNpubToClipboard}
            title={$i18n.t.nostr.copyToClipboard}
          >
            <img src={CopyIcon} alt="Copy" />
          </IconButton>
        </div>
        {#if showCopiedMessage}
          <span class="copied-message">{$i18n.t.nostr.copiedToClipboard}</span>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .pubkey-container {
    background-color: var(--color-surface-alt);
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }

  .pubkey-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .avatar {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .avatar-fallback {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--color-text-muted);
    user-select: none;
  }

  .pubkey-display {
    flex: 1;
    min-width: 0;
    word-break: break-all;
  }

  .npub-container {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 5px;
  }

  .npub-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .npub {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .copied-message {
    color: var(--color-success);
    font-size: 0.8rem;
    font-weight: bold;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
  }

  @media (max-width: 480px) {
    .pubkey-header {
      gap: 12px;
    }

    .avatar {
      width: 52px;
      height: 52px;
    }

    .avatar-fallback {
      font-size: 1.1rem;
    }
  }
</style>
