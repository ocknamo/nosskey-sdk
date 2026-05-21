/**
 * 現在ログイン中ユーザの Nostr プロフィール（kind:0）を保持する Svelte ストア。
 *
 * `publicKey` の購読をフックに、ログインが確定したら localStorage キャッシュを
 * 即座に出してカードを描画し、その後リレーから最新の kind:0 を取得して
 * 上書きする stale-while-revalidate 方式で動く。
 *
 * iframe 署名プロバイダモード（`?embedded=1`）では一切の fetch を行わない。
 * 署名 iframe は UI を出さず、ネットワークアクセスはプロバイダの責務外であり、
 * またユーザの存在を外部リレーに漏らさないため。
 */

import { writable } from 'svelte/store';
import { isEmbeddedIframeMode } from '../iframe-mode.js';
import {
  isSafePictureUrl,
  loadCachedProfile,
  saveCachedProfile,
} from '../services/profile-cache.js';
import { type FetchKind0Options, fetchKind0Profile } from '../services/profile-fetcher.js';
import { loadRelays } from '../services/relays-store.js';
import { publicKey } from './app-state.js';

export interface CurrentProfile {
  picture: string | null;
  name?: string;
  display_name?: string;
  loading: boolean;
}

export const currentProfile = writable<CurrentProfile | null>(null);

let lastLoadedPubkey: string | null = null;
let inflightToken = 0;

/**
 * 指定 pubkey のプロフィールを読み込む。先にキャッシュを反映し、その後で
 * 設定済み read リレーから最新を取りに行く。iframe モードでは何もしない。
 *
 * テスト用に `options.fetcherOptions`（fetcher への DI）と
 * `options.relays`（リレー一覧の上書き）を受け取れる。
 */
export async function loadProfileForPubkey(
  pubkey: string,
  options: { fetcherOptions?: FetchKind0Options; relays?: string[] } = {}
): Promise<void> {
  if (!pubkey) return;
  if (isEmbeddedIframeMode()) return;

  lastLoadedPubkey = pubkey;
  const myToken = ++inflightToken;

  const cached = loadCachedProfile(pubkey);
  if (cached) {
    currentProfile.set({
      picture: isSafePictureUrl(cached.picture) ?? null,
      name: cached.name,
      display_name: cached.display_name,
      loading: true,
    });
  } else {
    currentProfile.set({ picture: null, loading: true });
  }

  const relays =
    options.relays ??
    Object.entries(loadRelays())
      .filter(([, cfg]) => cfg.read)
      .map(([url]) => url);

  if (relays.length === 0) {
    // リレー設定が無いと取得しようがないので、キャッシュをそのまま確定させて終わる。
    if (myToken === inflightToken && lastLoadedPubkey === pubkey) {
      currentProfile.update((current) =>
        current ? { ...current, loading: false } : { picture: null, loading: false }
      );
    }
    return;
  }

  try {
    const result = await fetchKind0Profile(pubkey, relays, options.fetcherOptions);
    if (myToken !== inflightToken || lastLoadedPubkey !== pubkey) return;
    if (!result) {
      currentProfile.update((current) =>
        current ? { ...current, loading: false } : { picture: null, loading: false }
      );
      return;
    }
    const safePicture = isSafePictureUrl(result.picture);
    currentProfile.set({
      picture: safePicture,
      name: result.name,
      display_name: result.display_name,
      loading: false,
    });
    saveCachedProfile(pubkey, {
      picture: safePicture,
      name: result.name,
      display_name: result.display_name,
      updatedAt: Date.now(),
    });
  } catch (err) {
    if (myToken !== inflightToken || lastLoadedPubkey !== pubkey) return;
    console.warn('[nosskey] profile fetch failed:', err);
    currentProfile.update((current) =>
      current ? { ...current, loading: false } : { picture: null, loading: false }
    );
  }
}

export function clearCurrentProfile(): void {
  lastLoadedPubkey = null;
  inflightToken++;
  currentProfile.set(null);
}

// pubkey の変更（ログイン / ログアウト / インポート）に追従する。
// テスト環境（happy-dom）でも安全に動くよう、自動 fetch は遅延せずに行う。
// iframe モードでは loadProfileForPubkey 側で no-op になるため安全。
publicKey.subscribe((value) => {
  if (!value) {
    clearCurrentProfile();
    return;
  }
  if (value === lastLoadedPubkey) return;
  void loadProfileForPubkey(value);
});
