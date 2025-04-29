import { writable } from 'svelte/store';
import type { PWKBlob } from '../../../../src/types.js';

// デフォルトリレーのリスト
export const defaultRelays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];

// 画面状態
export const currentScreen = writable('auth'); // 'auth' または 'nostr' または 'settings'

// 認証状態
export const authenticated = writable(false);

// パスキー情報
export const credentialId = writable<Uint8Array | null>(null);

// Nostrキー情報
export const pwkBlob = writable<PWKBlob | null>(null);
export const publicKey = writable<string | null>(null);

// アプリケーション設定
export const cacheSecrets = writable<boolean>(true); // 秘密鍵情報をキャッシュするかどうか
export const cacheTimeout = writable<number>(300); // キャッシュのタイムアウト時間（秒）

// 秘密鍵情報のキャッシュ設定を読み込む
function loadCacheSecretsSetting() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nosskey_cache_secrets');
    // デフォルトはtrue（キャッシュする）
    return saved === null ? true : saved === 'true';
  }
  return true;
}

// キャッシュタイムアウト設定を読み込む
function loadCacheTimeoutSetting() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nosskey_cache_timeout');
    // デフォルトは300秒（5分）
    return saved === null ? 300 : parseInt(saved, 10);
  }
  return 300;
}

// 初期化
try {
  cacheSecrets.set(loadCacheSecretsSetting());
  cacheTimeout.set(loadCacheTimeoutSetting());
  
  // 設定が変更されたら保存
  cacheSecrets.subscribe(value => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_cache_secrets', String(value));
    }
  });
  
  cacheTimeout.subscribe(value => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_cache_timeout', String(value));
    }
  });
} catch (e) {
  console.error('設定の初期化に失敗しました:', e);
}

// リセット関数
export const resetState = () => {
  currentScreen.set('auth');
  authenticated.set(false);
  credentialId.set(null);
  pwkBlob.set(null);
  publicKey.set(null);
};
