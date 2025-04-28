import { writable } from 'svelte/store';
import type { PWKBlob } from '../../../../src/types.js';

// 画面状態
export const currentScreen = writable('auth'); // 'auth' または 'nostr'

// 認証状態
export const authenticated = writable(false);

// パスキー情報
export const credentialId = writable<Uint8Array | null>(null);

// Nostrキー情報
export const pwkBlob = writable<PWKBlob | null>(null);
export const publicKey = writable<string | null>(null);

// リセット関数
export const resetState = () => {
  currentScreen.set('auth');
  authenticated.set(false);
  credentialId.set(null);
  pwkBlob.set(null);
  publicKey.set(null);
};
