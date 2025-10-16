import { seckeySigner } from 'rx-nostr-crypto';
import { KeyCache } from './key-cache.js';
import { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';
import type {
  KeyCacheOptions,
  KeyOptions,
  NosskeyManagerLike,
  NostrEvent,
  NostrKeyInfo,
  NostrKeyStorageOptions,
  PasskeyCreationOptions,
  SignOptions,
} from './types.js';
/**
 * Nosskey class for Passkey-Derived Nostr Identity
 * @packageDocumentation
 */
import { bytesToHex, hexToBytes } from './utils.js';

// 標準salt値（"nostr-key"のUTF-8バイト）
const STANDARD_SALT = '6e6f7374722d6b6579';

/**
 * Nosskey - Passkey-Derived Nostr Keys
 */
export class NosskeyManager implements NosskeyManagerLike {
  // キーキャッシュ管理
  #keyCache: KeyCache;

  // 現在のNostrKeyInfo
  #currentKeyInfo: NostrKeyInfo | null = null;

  // NostrKeyInfo保存の設定
  #storageOptions: NostrKeyStorageOptions = {
    enabled: true,
    storageKey: 'nosskey_keyinfo',
  };

  /**
   * NosskeyManager コンストラクタ
   * @param options 初期化オプション
   */
  constructor(options?: {
    cacheOptions?: Partial<KeyCacheOptions>;
    storageOptions?: Partial<NostrKeyStorageOptions>;
  }) {
    // KeyCacheを初期化
    this.#keyCache = new KeyCache(options?.cacheOptions);

    if (options?.storageOptions) {
      this.#storageOptions = { ...this.#storageOptions, ...options.storageOptions };
    }

    // ストレージが有効な場合、NostrKeyInfoの読み込みを試みる
    if (this.#storageOptions.enabled) {
      const loadedKeyInfo = this.#loadKeyInfoFromStorage();
      if (loadedKeyInfo) {
        this.#currentKeyInfo = loadedKeyInfo;
      }
    }
  }

  /**
   * NostrKeyInfoストレージの設定を更新
   * @param options ストレージオプション
   */
  setStorageOptions(options: Partial<NostrKeyStorageOptions>): void {
    this.#storageOptions = { ...this.#storageOptions, ...options };

    // ストレージが無効化された場合はストレージからNostrKeyInfoを削除
    if (options.enabled === false) {
      this.clearStoredKeyInfo();
    }
  }

  /**
   * 現在のNostrKeyInfoストレージ設定を取得
   */
  getStorageOptions(): NostrKeyStorageOptions {
    return { ...this.#storageOptions };
  }

  /**
   * 現在のNostrKeyInfoを設定
   * ストレージが有効な場合は保存も行う
   * @param keyInfo 設定するNostrKeyInfo
   */
  setCurrentKeyInfo(keyInfo: NostrKeyInfo): void {
    this.#currentKeyInfo = keyInfo;

    // ストレージが有効な場合は保存
    if (this.#storageOptions.enabled) {
      void this.#saveKeyInfoToStorage(keyInfo);
    }
  }

  /**
   * 現在のNostrKeyInfoを取得
   * 未設定の場合はストレージからの読み込みを試みる
   */
  getCurrentKeyInfo(): NostrKeyInfo | null {
    // 現在のNostrKeyInfoがない場合はストレージからの読み込みを試みる
    if (!this.#currentKeyInfo && this.#storageOptions.enabled) {
      this.#currentKeyInfo = this.#loadKeyInfoFromStorage();
    }
    return this.#currentKeyInfo;
  }

  /**
   * NostrKeyInfoが存在するかどうかを確認
   * ストレージの設定に応じてメモリやストレージから検索
   * @returns NostrKeyInfoが存在するかどうか
   */
  hasKeyInfo(): boolean {
    // メモリに保持しているか確認
    if (this.#currentKeyInfo) {
      return true;
    }

    // ストレージが有効なら、そこから読み込みを試みる
    if (this.#storageOptions.enabled) {
      const loadedKeyInfo = this.#loadKeyInfoFromStorage();
      if (loadedKeyInfo) {
        // 副作用: メモリにもロードする
        this.#currentKeyInfo = loadedKeyInfo;
        return true;
      }
    }

    return false;
  }

  /**
   * NostrKeyInfoをストレージに保存（内部メソッド）
   * @param keyInfo 保存するNostrKeyInfo
   */
  async #saveKeyInfoToStorage(keyInfo: NostrKeyInfo): Promise<void> {
    if (!this.#storageOptions.enabled) return;

    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return;

    const key = this.#storageOptions.storageKey || 'nosskey_keyinfo';
    storage.setItem(key, JSON.stringify(keyInfo));
  }

  /**
   * ストレージからNostrKeyInfoを読み込み（内部メソッド）
   */
  #loadKeyInfoFromStorage(): NostrKeyInfo | null {
    if (!this.#storageOptions.enabled) return null;

    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return null;

    const key = this.#storageOptions.storageKey || 'nosskey_keyinfo';
    const data = storage.getItem(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as NostrKeyInfo;
    } catch (e) {
      console.error('Failed to parse stored NostrKeyInfo', e);
      return null;
    }
  }

  /**
   * ストレージに保存されたNostrKeyInfoをクリア
   */
  clearStoredKeyInfo(): void {
    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return;

    const key = this.#storageOptions.storageKey || 'nosskey_keyinfo';
    storage.removeItem(key);

    // 現在のNostrKeyInfoも消去
    this.#currentKeyInfo = null;
  }

  /**
   * NIP-07互換: 公開鍵を取得
   * 現在設定されているNostrKeyInfoから公開鍵を返す
   */
  async getPublicKey(): Promise<string> {
    const keyInfo = this.getCurrentKeyInfo();
    if (!keyInfo) {
      throw new Error('No current NostrKeyInfo set');
    }
    return keyInfo.pubkey;
  }

  /**
   * NIP-07互換: イベント署名
   * 現在設定されているNostrKeyInfoでイベントに署名
   * @param event 署名するNostrイベント
   */
  async signEvent(event: NostrEvent): Promise<NostrEvent> {
    const keyInfo = this.getCurrentKeyInfo();
    if (!keyInfo) {
      throw new Error('No current NostrKeyInfo set');
    }
    return this.signEventWithKeyInfo(event, keyInfo);
  }

  /**
   * キャッシュ設定を更新
   * @param options キャッシュオプション
   */
  setCacheOptions(options: Partial<KeyCacheOptions>): void {
    this.#keyCache.setCacheOptions(options);
  }

  /**
   * 現在のキャッシュ設定を取得
   */
  getCacheOptions(): KeyCacheOptions {
    return this.#keyCache.getCacheOptions();
  }

  /**
   * 特定の鍵のキャッシュをクリア
   * @param credentialId クレデンシャルID
   */
  clearCachedKey(credentialId: Uint8Array | string): void {
    this.#keyCache.clearCachedKey(credentialId);
  }

  /**
   * 全てのキャッシュをクリア
   */
  clearAllCachedKeys(): void {
    this.#keyCache.clearAllCachedKeys();
  }

  /**
   * PRF拡張機能がサポートされているかチェック
   */
  async isPrfSupported(): Promise<boolean> {
    return isPrfSupported();
  }

  /**
   * パスキーを作成（PRF拡張もリクエスト）
   * @param options パスキー作成オプション
   * @returns Credentialの識別子を返す
   */
  async createPasskey(options: PasskeyCreationOptions = {}): Promise<Uint8Array> {
    return createPasskey(options);
  }

  /**
   * PRF値を直接Nostrシークレットキーとして使用してNostrKeyInfoを作成
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async createNostrKey(credentialId?: Uint8Array, options: KeyOptions = {}): Promise<NostrKeyInfo> {
    // PRF秘密を取得（これが直接シークレットキーになる）
    const { secret: sk, id: responseId } = await getPrfSecret(credentialId);

    // secp256k1の有効範囲チェック(ここでは0チェックのみ)
    // 注: 実用上は確率が非常に低いため省略可能
    if (sk.every((byte) => byte === 0)) {
      throw new Error('Invalid PRF output: all zeros');
    }

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    // rx-nostr-cryptoを使用して公開鍵を取得
    const signer = seckeySigner(skHex);
    const publicKey = await signer.getPublicKey();

    // NostrKeyInfo構築
    const keyInfo: NostrKeyInfo = {
      credentialId: bytesToHex(credentialId || responseId),
      pubkey: publicKey,
      salt: STANDARD_SALT, // 標準salt値を使用
      ...(options.username && { username: options.username }), // usernameがあれば追加
    };

    // 結果を返却
    return keyInfo;
  }

  /**
   * イベントに署名
   * @param event 署名するNostrイベント
   * @param keyInfo NostrKeyInfo
   * @param options 署名オプション
   */
  async signEventWithKeyInfo(
    event: NostrEvent,
    keyInfo: NostrKeyInfo,
    options: SignOptions = {}
  ): Promise<NostrEvent> {
    const { clearMemory = true, tags } = options;

    // グローバル設定を使用
    const shouldUseCache = this.#keyCache.isEnabled();

    let sk: Uint8Array | undefined;

    // キャッシュが有効で、クレデンシャルIDがあり、キャッシュに鍵がある場合はそれを使用
    if (shouldUseCache) {
      sk = this.#keyCache.getKey(keyInfo.credentialId);
    }

    // キャッシュがない場合は通常の処理
    if (!sk) {
      // PRF値を取得（これが直接シークレットキー）
      const { secret: prfSecret } = await getPrfSecret(hexToBytes(keyInfo.credentialId));
      sk = prfSecret;

      // キャッシュが有効な場合は保存
      if (shouldUseCache) {
        this.#keyCache.setKey(keyInfo.credentialId, sk);
      }
    }

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    // rx-nostr-crypto seckeySigner を使用して署名
    const signer = seckeySigner(skHex, { tags });
    const signedEvent = await signer.signEvent(event);

    // キャッシュを使用しない場合、または明示的にclearMemory=trueの場合のみメモリクリア
    if (!shouldUseCache && clearMemory) {
      this.#clearKey(sk);
    }

    return signedEvent;
  }

  /**
   * 秘密鍵をエクスポート
   * @param keyInfo NostrKeyInfo
   * @param credentialId 使用するクレデンシャルID（省略時はNostrKeyInfoのcredentialIdから取得、またはユーザーが選択したパスキーが使用される）
   * @returns エクスポートされた秘密鍵（16進数文字列）
   */
  async exportNostrKey(keyInfo: NostrKeyInfo, credentialId?: Uint8Array): Promise<string> {
    // NostrKeyInfoからcredentialIdを取得（指定がある場合）
    let usedCredentialId = credentialId;

    // credentialIdが指定されていない場合はNostrKeyInfoから取得を試みる
    if (!usedCredentialId && keyInfo.credentialId) {
      usedCredentialId = hexToBytes(keyInfo.credentialId);
    }

    // PRF値を取得（これが直接シークレットキー）
    const { secret: sk } = await getPrfSecret(usedCredentialId);

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    return skHex;
  }

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  #clearKey(key: Uint8Array): void {
    key?.fill?.(0);
  }
}
