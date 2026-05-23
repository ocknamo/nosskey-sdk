import { NosskeyManager } from 'nosskey-sdk';
import { cacheSecrets, cacheTimeout } from '../store/secret-cache-settings.js';
import { CookieStorage } from './cookie-storage.js';
import { MultiStorage } from './multi-storage.js';

// シングルトンインスタンス
let instance: NosskeyManager | null = null;

// CookieStorage は iframe 側からも再利用するので別途保持しておく。
// `getNosskeyManager()` 呼び出し前に参照されないよう lazy 初期化。
let cookieStorageInstance: CookieStorage | null = null;

/**
 * NosskeyManager と共通の `CookieStorage` インスタンスを返す。iframe 側で SAA
 * grant 後（Safari 経路）に `manager.setStorageOptions({ storage })` で差し替える
 * 際に、スタンドアロンタブで dual-write された cookie を読むために使う。
 */
export function getCookieStorage(): CookieStorage {
  if (!cookieStorageInstance) {
    cookieStorageInstance = new CookieStorage();
  }
  return cookieStorageInstance;
}

// 設定の現在の値
let currentCacheEnabled = true;
let currentCacheTimeout = 300;

// キャッシュ設定の更新関数
function updateCacheSettings() {
  if (instance) {
    instance.setCacheOptions({
      enabled: currentCacheEnabled,
      timeoutMs: currentCacheTimeout * 1000, // 秒をミリ秒に変換
    });
  }
}

// NosskeyManagerのシングルトンインスタンスを取得
export function getNosskeyManager(): NosskeyManager {
  if (!instance) {
    // 初期化処理

    // サブスクリプション設定
    cacheSecrets.subscribe((value) => {
      currentCacheEnabled = value;
      if (instance) {
        updateCacheSettings();
      }
    });

    cacheTimeout.subscribe((value) => {
      currentCacheTimeout = value;
      if (instance) {
        updateCacheSettings();
      }
    });

    // 開発環境ではnosskey-sdk.pages.devを使用
    let rpId = location.host;
    if (location.host.includes('nosskey-sdk.pages.dev')) {
      rpId = 'nosskey-sdk.pages.dev';
      // サブドメイン(www.nosskey.app'など)ではなく'nosskey.app'を使用
    } else if (location.host.includes('nosskey.app')) {
      rpId = 'nosskey.app';
    }

    // localStorage を primary、CookieStorage をミラーとする dual-write を
    // セットする。スタンドアロンタブで `setCurrentKeyInfo` するたびに cookie
    // へミラーされ、iframe 側 (SAA grant 後の Safari) から first-party cookie
    // 経由で NostrKeyInfo を読み出せる。CookieStorage の Secure 属性は HTTPS
    // 必須なので、localhost dev では mirror がサイレントに失効する場合がある
    // が MultiStorage が隔離しているため primary 動作は影響を受けない。
    const cookieStorage = getCookieStorage();
    const lsBackend =
      typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
        ? window.localStorage
        : null;
    const storage: Storage = lsBackend
      ? new MultiStorage({ primary: lsBackend, mirrors: [cookieStorage] })
      : cookieStorage;

    instance = new NosskeyManager({
      cacheOptions: {
        enabled: currentCacheEnabled,
        timeoutMs: currentCacheTimeout * 1000, // 秒をミリ秒に変換
      },
      storageOptions: {
        enabled: true, // PWKの自動保存を有効化
        storageKey: 'nosskey_pwk', // SDKのデフォルト値を使用
        storage,
      },
      prfOptions: {
        rpId,
        userVerification: 'required',
      },
    });
  }
  return instance;
}

/**
 * 既に構築済みの NosskeyManager を返す。未構築なら null を返し、新規構築は
 * 行わない。`getNosskeyManager()` は `location.host` 参照などの副作用を伴う
 * ため、モジュール初期化時にストレージハンドルだけ覗きたい経路で使う。
 */
export function peekNosskeyManager(): NosskeyManager | null {
  return instance;
}

// インスタンスのリセット（主にテスト用）。`getCookieStorage()` のシングルトンも
// 同時にクリアし、テストで CookieStorage を別 fake document に差し替えたい
// ケースで前テストの残骸が混入しないようにする。
export function resetNosskeyManager(): void {
  instance = null;
  cookieStorageInstance = null;
}

// シークレットキーのキャッシュをクリア
export function clearSecretCache(): boolean {
  if (instance) {
    // SDKの提供するメソッドを使用
    instance.clearAllCachedKeys();
    return true;
  }
  return false;
}
