<script lang="ts">
import CopyIcon from '../assets/copy-icon.svg';
import { i18n } from '../i18n/i18n-store.js';
import { publicKey } from '../store/app-state.js';
import { currentProfile } from '../store/profile-store.js';
import { hexToNpub } from '../utils/bech32-converter.js';
import ProfileAvatar from './ProfileAvatar.svelte';
import IconButton from './ui/button/IconButton.svelte';

// 状態変数
let publicKeyHex = $state('');
let npubAddress = $state('');
let showCopiedMessage = $state(false);

// `publicKey` は SPA ライフタイムに一致するシングルトンストアで、このカードは
// Account 画面が存在する限り常時表示されるため unsubscribe は省略する
// （既存コードベースの subscribe パターンと揃える）。
publicKey.subscribe((value) => {
  publicKeyHex = value || '';

  if (publicKeyHex) {
    // npub形式に変換
    try {
      npubAddress = hexToNpub(publicKeyHex);
    } catch (error) {
      console.error('npub変換エラー:', error);
      npubAddress = 'Error: Could not convert to npub';
    }
  }
});

// kind:0 由来の表示名。display_name を優先し、無ければ name。
const profileName = $derived($currentProfile?.display_name || $currentProfile?.name || '');
// display_name と name が両方あり別物なら、name を @ハンドルとして補助表示する。
const profileHandle = $derived.by(() => {
  const p = $currentProfile;
  if (p?.display_name && p.name && p.name !== p.display_name) return p.name;
  return '';
});

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
  <ProfileAvatar pubkey={publicKeyHex} />

  {#if profileName}
    <h2 class="display-name">{profileName}</h2>
  {/if}
  {#if profileHandle}
    <p class="handle">@{profileHandle}</p>
  {/if}

  <div class="npub-section">
    <h3>{$i18n.t.nostr.publicKey}</h3>
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

<style>
  .pubkey-container {
    background-color: var(--color-surface-alt);
    padding: 24px 15px;
    border-radius: 5px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
  }

  .display-name {
    margin: 10px 0 0;
    font-size: 1.3rem;
    font-weight: 700;
    word-break: break-word;
  }

  .handle {
    margin: 0;
    font-size: 0.95rem;
    color: var(--color-text-muted);
    word-break: break-all;
  }

  .npub-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    max-width: 100%;
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
    word-break: break-all;
  }

  .copied-message {
    color: var(--color-success);
    font-size: 0.8rem;
    font-weight: bold;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }
</style>
