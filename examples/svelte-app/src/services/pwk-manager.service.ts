import { PWKManager } from '../../../../src/index.js';
import { cacheSecrets, cacheTimeout } from '../store/app-state.js';

// シングルトンインスタンス
let instance: PWKManager | null = null;

// cacheOptions の現在の値
let currentCacheEnabled = true;
let currentCacheTimeout = 300;

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

// キャッシュ設定の更新関数
function updateCacheSettings() {
  if (instance) {
    instance.setCacheOptions({
      enabled: currentCacheEnabled,
      timeoutMs: currentCacheTimeout * 1000, // 秒をミリ秒に変換
    });
  }
}

// PWKManagerのシングルトンインスタンスを取得
export function getPWKManager(): PWKManager {
  if (!instance) {
    instance = new PWKManager({
      cacheOptions: {
        enabled: currentCacheEnabled,
        timeoutMs: currentCacheTimeout * 1000, // 秒をミリ秒に変換
      },
    });
  }
  return instance;
}

// インスタンスのリセット（主にテスト用）
export function resetPWKManager(): void {
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
