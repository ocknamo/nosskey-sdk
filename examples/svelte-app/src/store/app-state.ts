import { writable } from 'svelte/store';
import { getNosskeyManager } from '../services/nosskey-manager.service.js';

// デフォルトリレーのリスト
export const defaultRelays = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://yabu.me',
];

export type ScreenName = 'account' | 'timeline' | 'settings' | 'key' | 'import';

export function isScreenName(hash: string): hash is ScreenName {
  return new Set(['account', 'timeline', 'settings', 'import']).has(hash);
}

// 画面状態
export const currentScreen = writable<ScreenName>('account'); // 'account' または 'timeline' または 'settings'

// 認証状態
export const isLoggedIn = writable(false);

// Nostrキー情報
export const publicKey = writable<string | null>(null);

// アプリケーション設定
export const cacheSecrets = writable<boolean>(true); // 秘密鍵情報をキャッシュするかどうか
export const cacheTimeout = writable<number>(300); // キャッシュのタイムアウト時間（秒）

// テーマ設定
export type ThemeMode = 'light' | 'dark' | 'auto';
export const currentTheme = writable<ThemeMode>('dark');

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
    return saved === null ? 300 : Number.parseInt(saved, 10);
  }
  return 300;
}

// テーマ設定を読み込む
function loadThemeSetting(): ThemeMode {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nosskey_theme');
    // デフォルトは'dark'（ダークモード）
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
  }
  return 'dark';
}

// 初期化
try {
  cacheSecrets.set(loadCacheSecretsSetting());
  cacheTimeout.set(loadCacheTimeoutSetting());
  currentTheme.set(loadThemeSetting());

  // 設定が変更されたら保存
  cacheSecrets.subscribe((value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_cache_secrets', String(value));
    }
  });

  cacheTimeout.subscribe((value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_cache_timeout', String(value));
    }
  });

  currentTheme.subscribe((value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_theme', value);
    }
  });
} catch (e) {
  console.error('設定の初期化に失敗しました:', e);
}

// リセット関数
export const resetState = () => {
  currentScreen.set('account');
  isLoggedIn.set(false);
  publicKey.set(null);
};

// ログアウト関数
export const logout = () => {
  // SDK側のアカウント情報をクリア
  const nosskeyManager = getNosskeyManager();
  nosskeyManager.clearStoredKeyInfo();

  // 公開鍵情報をクリア
  publicKey.set(null);

  // ログイン状態を更新
  isLoggedIn.set(false);

  // 画面を認証画面に戻す
  currentScreen.set('account');
};
