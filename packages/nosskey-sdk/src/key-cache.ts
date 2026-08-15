/**
 * Key cache management for Nosskey
 * @packageDocumentation
 */

import type { KeyCacheOptions } from './types.js';
import { bytesToHex } from './utils.js';

/**
 * Key cache entry with expiration time
 */
interface CacheEntry {
  id: string;
  /**
   * このエントリが属するアカウントの公開鍵（hex）。credentialId だけではエントリを
   * 一意に特定できないため（同じパスキーで wrap モードの鍵と直接モードの鍵を作ると
   * credentialId が同じで pubkey だけ異なるエントリが並ぶ）、読み出し時の照合に使う。
   * 未指定で保存された場合は undefined。
   */
  pubkey?: string;
  sk: Uint8Array;
  expireAt: number;
}

/**
 * Key cache manager for managing temporary secret keys
 */
export class KeyCache {
  // 一時的に保持する秘密鍵（単一エントリ）
  #cachedEntry: CacheEntry | null = null;

  // 現在アクティブなタイマー
  #expiryTimer: NodeJS.Timeout | null = null;

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
    // 設定が変更される場合は既存のキャッシュをクリア
    if (Object.keys(options).length > 0 && this.#cachedEntry !== null) {
      this.clearAllCachedKeys();
    }

    this.#cacheOptions = { ...this.#cacheOptions, ...options };
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
  setKey(credentialId: Uint8Array | string, sk: Uint8Array, pubkey?: string): void {
    if (!this.#cacheOptions.enabled) return;

    const id = typeof credentialId === 'string' ? credentialId : bytesToHex(credentialId);
    const timeout =
      this.#cacheOptions.timeoutMs !== undefined ? this.#cacheOptions.timeoutMs : 5 * 60 * 1000;
    const expireAt = Date.now() + timeout;

    // 既存のキャッシュエントリをクリア
    this.#clearCachedEntry();

    // 新しいエントリを保存
    this.#cachedEntry = {
      id,
      ...(pubkey !== undefined && { pubkey }),
      sk: new Uint8Array(sk),
      expireAt,
    };

    // 期限切れタイマーを設定（エラー時は安全にキャッシュをクリア）
    try {
      this.#scheduleExpiry();
    } catch (error) {
      // タイマー設定に失敗した場合は即座にキャッシュをクリア
      this.#clearCachedEntry();
      throw error;
    }
  }

  /**
   * キャッシュから秘密鍵を取得
   *
   * `pubkey` を渡した場合、保存時の pubkey と一致しなければキャッシュミスとして扱う。
   * credentialId は同一パスキーから作られた複数アカウント（wrap モードと直接モード等）で
   * 重複しうるため、これが無いと**別アカウントの秘密鍵**を返してしまい、表示される
   * 公開鍵と実際の署名鍵が食い違う。
   *
   * @param credentialId クレデンシャルID
   * @param pubkey 期待するアカウントの公開鍵（hex）。省略時は照合しない
   * @returns 有効な秘密鍵またはundefined
   */
  getKey(credentialId: Uint8Array | string, pubkey?: string): Uint8Array | undefined {
    if (!this.#cacheOptions.enabled) return undefined;

    const id = typeof credentialId === 'string' ? credentialId : bytesToHex(credentialId);
    return this.#getCachedKeyIfValid(id, pubkey);
  }

  /**
   * 特定の鍵のキャッシュをクリア
   * @param credentialId クレデンシャルID
   */
  clearCachedKey(credentialId: Uint8Array | string): void {
    const id = typeof credentialId === 'string' ? credentialId : bytesToHex(credentialId);

    if (this.#cachedEntry && this.#cachedEntry.id === id) {
      this.#clearCachedEntry();
    }
  }

  /**
   * 全てのキャッシュをクリア
   */
  clearAllCachedKeys(): void {
    this.#clearCachedEntry();
  }

  /**
   * キャッシュされた秘密鍵の有効期限をチェックし、有効であれば返す
   * 無効な場合はキャッシュから削除してundefinedを返す
   * @param credentialId クレデンシャルID
   * @returns 有効な秘密鍵またはundefined
   */
  #getCachedKeyIfValid(credentialId: string, pubkey?: string): Uint8Array | undefined {
    if (!this.#cachedEntry || this.#cachedEntry.id !== credentialId) {
      return undefined;
    }

    // pubkey を指定されたら必ず一致を要求する。保存時に pubkey を持たないエントリ
    // （旧経路・テスト用）は「どのアカウントのものか不明」なのでミス扱いにする。
    if (pubkey !== undefined && this.#cachedEntry.pubkey !== pubkey) {
      return undefined;
    }

    // 有効期限をチェック
    if (Date.now() < this.#cachedEntry.expireAt) {
      return this.#cachedEntry.sk;
    }

    // 期限切れの場合は削除
    this.#clearCachedEntry();
    return undefined;
  }

  /**
   * キャッシュエントリをクリアし、タイマーも停止
   */
  #clearCachedEntry(): void {
    // キャッシュエントリをクリア
    if (this.#cachedEntry) {
      this.#clearKey(this.#cachedEntry.sk);
      this.#cachedEntry = null;
    }

    // タイマーをクリア
    if (this.#expiryTimer) {
      clearTimeout(this.#expiryTimer);
      this.#expiryTimer = null;
    }
  }

  /**
   * 期限切れタイマーを設定
   */
  #scheduleExpiry(): void {
    if (!this.#cachedEntry) return;

    const now = Date.now();
    const timeToExpiry = this.#cachedEntry.expireAt - now;

    // 既に期限切れの場合は即座に削除
    if (timeToExpiry <= 0) {
      this.#clearCachedEntry();
      return;
    }

    // タイマーを設定（期限+1msで実行）
    this.#expiryTimer = setTimeout(() => {
      this.#clearCachedEntry();
    }, timeToExpiry + 1);
  }

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  #clearKey(key: Uint8Array): void {
    key?.fill?.(0);
  }
}
