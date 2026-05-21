<script lang="ts">
import { i18n } from '../i18n/i18n-store.js';
import { currentProfile } from '../store/profile-store.js';

interface Props {
  /**
   * フォールバック表示（先頭2文字の initials）に使う公開鍵 hex。
   * 画像自体は常にログイン中ユーザの `currentProfile` を表示するため、
   * 他ユーザの pubkey を渡す用途には使えない（initials と画像がズレる）。
   */
  pubkey: string;
}

const { pubkey }: Props = $props();

let pictureUrl = $state<string | null>(null);
let pictureBroken = $state(false);

const initials = $derived(pubkey ? pubkey.slice(0, 2).toUpperCase() : '');

// `currentProfile` は SPA ライフタイムに一致するシングルトンストアのため
// unsubscribe は省略する（既存コードベースの subscribe パターンと揃える）。
// このコンポーネントを短命なリスト要素等で複数インスタンス化して再利用する
// 場合は、購読リークを避けるため onDestroy での解除を検討すること。
// プロフィール画像 URL が変わったらロードエラーフラグもリセットする。
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
</script>

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
      {initials}
    </span>
  {/if}
</div>

<style>
  .avatar {
    flex-shrink: 0;
    width: 120px;
    height: 120px;
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
    font-size: 2.6rem;
    font-weight: 600;
    color: var(--color-text-muted);
    user-select: none;
  }

  @media (max-width: 480px) {
    .avatar {
      width: 96px;
      height: 96px;
    }

    .avatar-fallback {
      font-size: 2rem;
    }
  }
</style>
