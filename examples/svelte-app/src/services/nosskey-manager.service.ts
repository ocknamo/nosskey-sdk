import { NosskeyManager } from '../../../../src/index.js';
import { cacheSecrets, cacheTimeout } from '../store/app-state.js';

// シングルトンインスタンス
let instance: NosskeyManager | null = null;

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

    instance = new NosskeyManager({
      cacheOptions: {
        enabled: currentCacheEnabled,
        timeoutMs: currentCacheTimeout * 1000, // 秒をミリ秒に変換
      },
      storageOptions: {
        enabled: true, // PWKの自動保存を有効化
        storageKey: 'nosskey_pwk', // SDKのデフォルト値を使用
      },
      prfOptions: {
        rpId,
        userVerification: 'required',
      },
    });
  }
  return instance;
}

// インスタンスのリセット（主にテスト用）
export function resetNosskeyManager(): void {
  instance = null;
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
