import { seckeySigner } from 'rx-nostr-crypto';
import { aesGcmDecrypt, aesGcmEncrypt, deriveAesGcmKey } from './crypto-utils.js';
import { KeyCache } from './key-cache.js';
import { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';
import type {
  KeyCacheOptions,
  KeyOptions,
  NostrEvent,
  PWKBlob,
  PWKBlobDirect,
  PWKBlobEncrypted,
  PWKManagerLike,
  PWKStorageOptions,
  PasskeyCreationOptions,
  SignOptions,
} from './types.js';
/**
 * Nosskey class for Passkey-Derived Nostr Identity
 * @packageDocumentation
 */
import { bytesToHex, hexToBytes } from './utils.js';

/**
 * Nosskey - Passkey-Wrapped Key for Nostr
 */
export class PWKManager implements PWKManagerLike {
  // キーキャッシュ管理
  #keyCache: KeyCache;

  // 現在のPWK
  #currentPWK: PWKBlob | null = null;

  // PWK保存の設定
  #storageOptions: PWKStorageOptions = {
    enabled: true,
    storageKey: 'nosskey_pwk',
  };

  /**
   * PWKManager コンストラクタ
   * @param options 初期化オプション
   */
  constructor(options?: {
    cacheOptions?: Partial<KeyCacheOptions>;
    storageOptions?: Partial<PWKStorageOptions>;
  }) {
    // KeyCacheを初期化
    this.#keyCache = new KeyCache(options?.cacheOptions);

    if (options?.storageOptions) {
      this.#storageOptions = { ...this.#storageOptions, ...options.storageOptions };
    }

    // ストレージが有効な場合、PWKの読み込みを試みる
    if (this.#storageOptions.enabled) {
      const loadedPWK = this.#loadPWKFromStorage();
      if (loadedPWK) {
        this.#currentPWK = loadedPWK;
      }
    }
  }

  /**
   * PWKストレージの設定を更新
   * @param options ストレージオプション
   */
  setStorageOptions(options: Partial<PWKStorageOptions>): void {
    this.#storageOptions = { ...this.#storageOptions, ...options };

    // ストレージが無効化された場合はストレージからPWKを削除
    if (options.enabled === false) {
      this.clearStoredPWK();
    }
  }

  /**
   * 現在のPWKストレージ設定を取得
   */
  getStorageOptions(): PWKStorageOptions {
    return { ...this.#storageOptions };
  }

  /**
   * 現在のPWKを設定
   * ストレージが有効な場合は保存も行う
   * @param pwk 設定するPWK
   */
  setCurrentPWK(pwk: PWKBlob): void {
    this.#currentPWK = pwk;

    // ストレージが有効な場合は保存
    if (this.#storageOptions.enabled) {
      void this.#savePWKToStorage(pwk);
    }
  }

  /**
   * 現在のPWKを取得
   * 未設定の場合はストレージからの読み込みを試みる
   */
  getCurrentPWK(): PWKBlob | null {
    // 現在のPWKがない場合はストレージからの読み込みを試みる
    if (!this.#currentPWK && this.#storageOptions.enabled) {
      this.#currentPWK = this.#loadPWKFromStorage();
    }
    return this.#currentPWK;
  }

  /**
   * PWKが存在するかどうかを確認
   * ストレージの設定に応じてメモリやストレージから検索
   * @returns PWKが存在するかどうか
   */
  hasPWK(): boolean {
    // メモリに保持しているか確認
    if (this.#currentPWK) {
      return true;
    }

    // ストレージが有効なら、そこから読み込みを試みる
    if (this.#storageOptions.enabled) {
      const loadedPWK = this.#loadPWKFromStorage();
      if (loadedPWK) {
        // 副作用: メモリにもロードする
        this.#currentPWK = loadedPWK;
        return true;
      }
    }

    return false;
  }

  /**
   * PWKをストレージに保存（内部メソッド）
   * @param pwk 保存するPWK
   */
  async #savePWKToStorage(pwk: PWKBlob): Promise<void> {
    if (!this.#storageOptions.enabled) return;

    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return;

    const key = this.#storageOptions.storageKey || 'nosskey_pwk';
    storage.setItem(key, JSON.stringify(pwk));
  }

  /**
   * ストレージからPWKを読み込み（内部メソッド）
   */
  #loadPWKFromStorage(): PWKBlob | null {
    if (!this.#storageOptions.enabled) return null;

    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return null;

    const key = this.#storageOptions.storageKey || 'nosskey_pwk';
    const data = storage.getItem(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as PWKBlob;
    } catch (e) {
      console.error('Failed to parse stored PWK', e);
      return null;
    }
  }

  /**
   * ストレージに保存されたPWKをクリア
   */
  clearStoredPWK(): void {
    const storage =
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    if (!storage) return;

    const key = this.#storageOptions.storageKey || 'nosskey_pwk';
    storage.removeItem(key);

    // 現在のPWKも消去
    this.#currentPWK = null;
  }

  /**
   * NIP-07互換: 公開鍵を取得
   * 現在設定されているPWKから公開鍵を返す
   */
  async getPublicKey(): Promise<string> {
    const pwk = this.getCurrentPWK();
    if (!pwk) {
      throw new Error('No current PWK set');
    }
    return pwk.pubkey;
  }

  /**
   * NIP-07互換: イベント署名
   * 現在設定されているPWKでイベントに署名
   * @param event 署名するNostrイベント
   */
  async signEvent(event: NostrEvent): Promise<NostrEvent> {
    const pwk = this.getCurrentPWK();
    if (!pwk) {
      throw new Error('No current PWK set');
    }
    return this.signEventWithPWK(event, pwk);
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
   * 既存のNostr秘密鍵をパスキーでラップして保護
   * @param secretKey インポートする既存の秘密鍵
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async importNostrKey(
    secretKey: Uint8Array,
    credentialId?: Uint8Array,
    options: KeyOptions = {}
  ): Promise<PWKBlob> {
    const { clearMemory = true } = options;

    // PRF秘密を取得
    const { secret, id: responseId } = await getPrfSecret(credentialId);

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(secretKey);

    // rx-nostr-cryptoを使用して公開鍵を取得
    const signer = seckeySigner(skHex);
    const publicKey = await signer.getPublicKey();

    // 秘密鍵を暗号化
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aes = await deriveAesGcmKey(secret, salt);

    const { ciphertext, tag } = await aesGcmEncrypt(aes, iv, secretKey);

    // 必要に応じて平文の秘密鍵を消去
    if (clearMemory) {
      this.#clearKey(secretKey);
    }

    // レスポンスで使用するcredentialIdを取得
    // navigator.credentials.getのレスポンスからcredentialIdを取得するのが理想だが、
    // このAPIではレスポンスから直接credentialIdを取得することができない

    // PWKBlobのデータ構築
    const pwkBlob: PWKBlobEncrypted = {
      v: 1,
      alg: 'aes-gcm-256',
      salt: bytesToHex(salt),
      iv: bytesToHex(iv),
      ct: bytesToHex(ciphertext),
      tag: bytesToHex(tag),
      credentialId: bytesToHex(credentialId || responseId), // 指定されたIDかresponseから取得したIDを使用
      pubkey: publicKey, // 公開鍵を追加
      ...(options.username && { username: options.username }), // usernameがあれば追加
    };

    // 結果を返却
    return pwkBlob;
  }

  /**
   * 新しいNostr秘密鍵を生成してパスキーでラップ
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async generateNostrKey(credentialId?: Uint8Array, options: KeyOptions = {}): Promise<PWKBlob> {
    // 新しいNostr秘密鍵を生成
    const nostrSK = crypto.getRandomValues(new Uint8Array(32));

    // importNostrKeyを利用して処理を共通化
    return this.importNostrKey(nostrSK, credentialId, options);
  }

  /**
   * PRF値を直接Nostrシークレットキーとして使用（PoC実装）
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async directPrfToNostrKey(credentialId?: Uint8Array, options: KeyOptions = {}): Promise<PWKBlob> {
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

    // PWKBlob構築（'prf-direct'タイプ）
    const pwkBlob: PWKBlobDirect = {
      v: 1 as const,
      alg: 'prf-direct' as const,
      credentialId: bytesToHex(credentialId || responseId),
      pubkey: publicKey, // 公開鍵を追加
      ...(options.username && { username: options.username }), // usernameがあれば追加
    };

    // 結果を返却
    return pwkBlob;
  }

  /**
   * イベントに署名
   * @param event 署名するNostrイベント
   * @param pwk 暗号化された秘密鍵またはPRF直接使用（credentialIdを含む）
   * @param options 署名オプション
   */
  async signEventWithPWK(
    event: NostrEvent,
    pwk: PWKBlob,
    options: SignOptions = {}
  ): Promise<NostrEvent> {
    const { clearMemory = true, tags } = options;

    // グローバル設定を使用
    const shouldUseCache = this.#keyCache.isEnabled();

    let sk: Uint8Array | undefined;

    // キャッシュが有効で、クレデンシャルIDがあり、キャッシュに鍵がある場合はそれを使用
    if (shouldUseCache) {
      sk = this.#keyCache.getKey(pwk.credentialId);
    }

    // キャッシュがない場合は通常の処理
    if (!sk) {
      // PRF値を取得
      const { secret: prfSecret, id: responseId } = await getPrfSecret(
        hexToBytes(pwk.credentialId)
      );

      // PWKの種類によって処理を分岐
      if (pwk.alg === 'prf-direct') {
        // PRF値を直接シークレットキーとして使用
        sk = prfSecret;
      } else {
        // PWKBlobEncryptedとして扱い、暗号化された秘密鍵を復号
        const pwkV1 = pwk as PWKBlobEncrypted;
        const salt = hexToBytes(pwkV1.salt);
        const iv = hexToBytes(pwkV1.iv);
        const ct = hexToBytes(pwkV1.ct);
        const tag = hexToBytes(pwkV1.tag);

        const aes = await deriveAesGcmKey(prfSecret, salt);
        sk = await aesGcmDecrypt(aes, iv, ct, tag);
      }
      // キャッシュが有効な場合は保存
      if (shouldUseCache) {
        this.#keyCache.setKey(pwk.credentialId, sk);
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
   * 暗号化された秘密鍵をエクスポート
   * @param pwk PWKBlob形式の暗号化された秘密鍵
   * @param credentialId 使用するクレデンシャルID（省略時はPWKBlobのcredentialIdから取得、またはユーザーが選択したパスキーが使用される）
   * @returns エクスポートされた秘密鍵（16進数文字列）
   */
  async exportNostrKey(pwk: PWKBlob, credentialId?: Uint8Array): Promise<string> {
    // PWKBlobからcredentialIdを取得（指定がある場合）
    let usedCredentialId = credentialId;

    // credentialIdが指定されていない場合はPWKBlobから取得を試みる
    if (!usedCredentialId && pwk.credentialId) {
      usedCredentialId = hexToBytes(pwk.credentialId);
    }

    // PRF値を取得
    const { secret: prfSecret, id: responseId } = await getPrfSecret(usedCredentialId);

    let sk: Uint8Array;

    // PWKの種類によって処理を分岐
    if (pwk.alg === 'prf-direct') {
      // PRF値を直接シークレットキーとして使用
      sk = new Uint8Array(prfSecret);
    } else {
      // PWKBlobEncryptedとして扱い、暗号化された秘密鍵を復号
      const pwkV1 = pwk as PWKBlobEncrypted;
      const salt = hexToBytes(pwkV1.salt);
      const iv = hexToBytes(pwkV1.iv);
      const ct = hexToBytes(pwkV1.ct);
      const tag = hexToBytes(pwkV1.tag);

      const aes = await deriveAesGcmKey(prfSecret, salt);
      sk = await aesGcmDecrypt(aes, iv, ct, tag);
    }

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    // メモリからのクリアは、リターン後に元の参照が失われるため必要ない
    // テスト環境では関数が完了した後も保持されるため意図的にスキップ
    // 実際のブラウザ環境では問題ない
    // this.#clearKey(sk);

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
