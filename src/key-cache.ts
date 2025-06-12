/**
 * Key cache management for Nosskey
 * @packageDocumentation
 */

import type { KeyCacheOptions } from './types.js';
import { bytesToHex } from './utils.js';

/**
 * Key cache manager for managing temporary secret keys
 */
export class KeyCache {
  // 一時的に保持する秘密鍵
  #cachedKeys: Map<string, { sk: Uint8Array; expireAt: number }> = new Map();

  // キャッシュの設定
  #cacheOptions: KeyCacheOptions = {
    enabled: false,
    timeoutMs: 5 * 60 * 1000, // デフォルト5分
  };

  /**
   * KeyCache コンストラクタ
   * @param options 初期化オプション
   */
  constructor(options?: Partial<KeyCacheOptions>) {
    if (options) {
      this.#cacheOptions = { ...this.#cacheOptions, ...options };
    }
  }

  /**
   * キャッシュ設定を更新
   * @param options キャッシュオプション
   */
  setCacheOptions(options: Partial<KeyCacheOptions>): void {
    this.#cacheOptions = { ...this.#cacheOptions, ...options };

    // キャッシュが無効化された場合は全てのキャッシュをクリア
    if (options.enabled === false) {
      this.clearAllCachedKeys();
    }
  }

  /**
   * 現在のキャッシュ設定を取得
   */
  getCacheOptions(): KeyCacheOptions {
    return { ...this.#cacheOptions };
  }

  /**
   * キャッシュが有効かどうか
   */
  isEnabled(): boolean {
    return this.#cacheOptions.enabled;
  }

  /**
   * キーをキャッシュに保存
   * @param credentialId クレデンシャルID
   * @param sk 秘密鍵
   */
  setKey(credentialId: Uint8Array | string, sk: Uint8Array): void {
    if (!this.#cacheOptions.enabled) return;

    const id = typeof credentialId === 'string' ? credentialId : bytesToHex(credentialId);
    const timeout =
      this.#cacheOptions.timeoutMs !== undefined ? this.#cacheOptions.timeoutMs : 5 * 60 * 1000;
    const expireAt = Date.now() + timeout;

    // コピーを作成して保存
    this.#cachedKeys.set(id, {
      sk: new Uint8Array(sk),
      expireAt,
    });
  }

  /**
   * キャッシュから秘密鍵を取得
   * @param credentialId クレデンシャルID
   * @returns 有効な秘密鍵またはundefined
   */
  getKey(credentialId: Uint8Array | string): Uint8Array | undefined {
    if (!this.#cacheOptions.enabled) return undefined;

    const id = typeof credentialId === 'string' ? credentialId : bytesToHex(credentialId);
    return this.#getCachedKeyIfValid(id);
  }

  /**
   * 特定の鍵のキャッシュをクリア
   * @param credentialId クレデンシャルID
   */
  clearCachedKey(credentialId: Uint8Array | string): void {
    const id = typeof credentialId === 'string' ? credentialId : bytesToHex(credentialId);
    const cached = this.#cachedKeys.get(id);
    if (cached) {
      this.#clearKey(cached.sk);
      this.#cachedKeys.delete(id);
    }
  }

  /**
   * 全てのキャッシュをクリア
   */
  clearAllCachedKeys(): void {
    for (const { sk } of this.#cachedKeys.values()) {
      this.#clearKey(sk);
    }
    this.#cachedKeys.clear();
  }

  /**
   * キャッシュされた秘密鍵の有効期限をチェックし、有効であれば返す
   * 無効な場合はキャッシュから削除してundefinedを返す
   * @param credentialId クレデンシャルID
   * @returns 有効な秘密鍵またはundefined
   */
  #getCachedKeyIfValid(credentialId: string): Uint8Array | undefined {
    if (!this.#cachedKeys.has(credentialId)) {
      return undefined;
    }

    const cached = this.#cachedKeys.get(credentialId);
    if (!cached) {
      return undefined;
    }

    // 有効期限をチェック
    if (Date.now() < cached.expireAt) {
      return cached.sk;
    }
    // 期限切れの場合は削除
    this.#removeExpiredCachedKey(credentialId, cached);
    return undefined;
  }

  /**
   * 期限切れのキャッシュエントリを削除し、秘密鍵をメモリからクリア
   * @param credentialId クレデンシャルID
   * @param cached キャッシュされたエントリ
   */
  #removeExpiredCachedKey(
    credentialId: string,
    cached: { sk: Uint8Array; expireAt: number }
  ): void {
    this.#cachedKeys.delete(credentialId);
    this.#clearKey(cached.sk);
  }

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  #clearKey(key: Uint8Array): void {
    key?.fill?.(0);
  }
}
