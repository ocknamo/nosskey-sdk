import { seckeySigner } from '@rx-nostr/crypto';
import { KeyCache } from './key-cache.js';
import { nip04Decrypt, nip04Encrypt } from './nip04.js';
import { nip44Decrypt, nip44Encrypt } from './nip44.js';
import { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';
import type {
  GetPrfSecretOptions,
  KeyCacheOptions,
  KeyOptions,
  NosskeyManagerLike,
  NosskeyManagerOptions,
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

// 標準salt値（"nostr-pwk"のUTF-8バイトのhex）。実際のPRF評価入力と一致する。
const STANDARD_SALT = '6e6f7374722d70776b';

// 旧誤値（"nostr-key"のhex）。過去に保存された NostrKeyInfo に残っている可能性があるが、
// 実際の導出は常に "nostr-pwk" で行われていたため、標準値へ正規化して扱う。
const LEGACY_SALT = '6e6f7374722d6b6579';

/**
 * NostrKeyInfo.salt をPRF評価入力として使える値に正規化する。
 * 未設定・旧誤値は標準salt値に置き換える（既存鍵の保護）。
 */
function normalizeSalt(salt?: string): string {
  return !salt || salt === LEGACY_SALT ? STANDARD_SALT : salt;
}

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

  // PRF取得時のオプション
  #prfOptions: GetPrfSecretOptions = {};

  /**
   * NosskeyManager コンストラクタ
   * @param options 初期化オプション
   */
  constructor(options?: NosskeyManagerOptions) {
    // KeyCacheを初期化
    this.#keyCache = new KeyCache(options?.cacheOptions);

    if (options?.storageOptions) {
      this.#storageOptions = { ...this.#storageOptions, ...options.storageOptions };
    }

    // 重要なoptionなので外れないようにデフォルト値を設定
    const userVerification = options?.prfOptions?.userVerification ?? 'required';
    if (options?.prfOptions) {
      this.#prfOptions = { ...options.prfOptions, userVerification };
    } else {
      this.#prfOptions = { userVerification };
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
    // storage 参照が差し替わったら in-memory cache は別バケットの値を握って
    // しまっているので破棄する。次回 getCurrentKeyInfo() で新しい storage から
    // 読み直す。iframe で SAA grant 後に handle.localStorage を流し込む経路で
    // partitioned 由来のキャッシュが残り続けるのを防ぐのが主目的。
    const storageChanged = 'storage' in options && options.storage !== this.#storageOptions.storage;
    this.#storageOptions = { ...this.#storageOptions, ...options };
    if (storageChanged) {
      this.#currentKeyInfo = null;
    }

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
   * NostrKeyInfoをストレージに保存
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
   * ストレージからNostrKeyInfoを読み込み
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
      const keyInfo = JSON.parse(data) as NostrKeyInfo;
      const normalizedSalt = normalizeSalt(keyInfo.salt);
      if (keyInfo.salt !== normalizedSalt) {
        // 旧誤値で保存された NostrKeyInfo を標準salt値へ修復保存する
        keyInfo.salt = normalizedSalt;
        void this.#saveKeyInfoToStorage(keyInfo);
      }
      return keyInfo;
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
   * パスキーを作成（PRF拡張もリクエスト）
   * @param options パスキー作成オプション。なければコンストラクタで設定された値を設定する。
   * @returns Credentialの識別子を返す
   */
  async createPasskey(options: PasskeyCreationOptions = {}): Promise<Uint8Array> {
    return createPasskey({
      rp: {
        id: this.#prfOptions.rpId,
        name: this.#prfOptions.rpId,
      },
      authenticatorSelection: {
        userVerification: this.#prfOptions.userVerification,
      },
      ...options,
    });
  }

  /**
   * PRF値を直接Nostrシークレットキーとして使用してNostrKeyInfoを作成
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async createNostrKey(credentialId?: Uint8Array, options: KeyOptions = {}): Promise<NostrKeyInfo> {
    // PRF秘密を取得（これが直接シークレットキーになる）。標準salt値を導出入力に使用する。
    const { secret: sk, id: responseId } = await getPrfSecret(
      credentialId,
      this.#prfOptions,
      hexToBytes(STANDARD_SALT)
    );

    // secp256k1の有効範囲チェック(ここでは0チェックのみ)
    // 注: 実用上は確率が非常に低いため省略可能
    if (sk.every((byte) => byte === 0)) {
      throw new Error('Invalid PRF output: all zeros');
    }

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    // @rx-nostr/cryptoを使用して公開鍵を取得
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
    const sk = await this.#getSecretKey(keyInfo);
    try {
      const signer = seckeySigner(bytesToHex(sk.bytes), { tags });
      return await signer.signEvent(event);
    } finally {
      // release() が cache 有効時は no-op、無効時のみ #clearKey を実行する。
      // clearMemory=false なら呼ばないので「キャッシュ無効でも残す」も可能。
      if (clearMemory) sk.release();
    }
  }

  /**
   * 秘密鍵をエクスポート
   * @param keyInfo NostrKeyInfo
   * @param credentialId 使用するクレデンシャルID（省略時はNostrKeyInfoのcredentialIdから取得、またはユーザーが選択したパスキーが使用される）
   * @param options オプション
   * @returns エクスポートされた秘密鍵（16進数文字列）
   */
  async exportNostrKey(keyInfo: NostrKeyInfo, credentialId?: Uint8Array): Promise<string> {
    // NostrKeyInfoからcredentialIdを取得（指定がある場合）
    let usedCredentialId = credentialId;

    // credentialIdが指定されていない場合はNostrKeyInfoから取得を試みる
    if (!usedCredentialId && keyInfo.credentialId) {
      usedCredentialId = hexToBytes(keyInfo.credentialId);
    }

    // PRF値を取得（これが直接シークレットキー）。keyInfo.salt を導出入力に使用する。
    const { secret: sk } = await getPrfSecret(
      usedCredentialId,
      this.#prfOptions,
      hexToBytes(normalizeSalt(keyInfo.salt))
    );

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    return skHex;
  }

  /**
   * PRF拡張機能がサポートされているかチェック
   */
  async isPrfSupported(): Promise<boolean> {
    return isPrfSupported();
  }

  /**
   * NIP-44 v2 で平文を暗号化
   */
  async nip44Encrypt(peerPubkey: string, plaintext: string): Promise<string> {
    const sk = await this.#getSecretKey();
    try {
      return nip44Encrypt(plaintext, sk.bytes, peerPubkey);
    } finally {
      sk.release();
    }
  }

  /**
   * NIP-44 v2 ペイロードを復号
   */
  async nip44Decrypt(peerPubkey: string, ciphertext: string): Promise<string> {
    const sk = await this.#getSecretKey();
    try {
      return nip44Decrypt(ciphertext, sk.bytes, peerPubkey);
    } finally {
      sk.release();
    }
  }

  /**
   * NIP-04（レガシー）で平文を暗号化
   */
  async nip04Encrypt(peerPubkey: string, plaintext: string): Promise<string> {
    const sk = await this.#getSecretKey();
    try {
      return nip04Encrypt(plaintext, sk.bytes, peerPubkey);
    } finally {
      sk.release();
    }
  }

  /**
   * NIP-04 ペイロードを復号
   */
  async nip04Decrypt(peerPubkey: string, ciphertext: string): Promise<string> {
    const sk = await this.#getSecretKey();
    try {
      return nip04Decrypt(ciphertext, sk.bytes, peerPubkey);
    } finally {
      sk.release();
    }
  }

  /**
   * NostrKeyInfo から秘密鍵を解決する。
   *
   * @param keyInfoOverride 明示的に使う鍵情報。省略時は `getCurrentKeyInfo()` を使う。
   *
   * 戻り値の `bytes` の所有権:
   * - **読み取り専用**として扱うこと。キャッシュ有効時は `bytes` がキャッシュ
   *   内のバッファと同一参照になっており、書き換えると以降の呼び出しが壊れる。
   * - キャッシュ無効時は呼び出し側でこのバッファを変更しても問題ないが、
   *   `release()` が `.fill(0)` でゼロ化するので変更には意味がない。
   * - 使い終わったら必ず `release()` を呼ぶこと（try/finally）。
   *
   * キャッシュ動作:
   * - キャッシュが有効ならキャッシュを参照し、無ければ PRF で取得して保存する
   * - キャッシュが無効な場合は呼び出し側で `release()` 時に消去される一時バッファを返す
   */
  async #getSecretKey(
    keyInfoOverride?: NostrKeyInfo
  ): Promise<{ bytes: Uint8Array; release: () => void }> {
    const keyInfo = keyInfoOverride ?? this.getCurrentKeyInfo();
    if (!keyInfo) {
      throw new Error('No current NostrKeyInfo set');
    }
    const shouldUseCache = this.#keyCache.isEnabled();

    if (shouldUseCache) {
      const cached = this.#keyCache.getKey(keyInfo.credentialId);
      if (cached) {
        return { bytes: cached, release: () => undefined };
      }
    }

    const { secret } = await getPrfSecret(
      hexToBytes(keyInfo.credentialId),
      this.#prfOptions,
      hexToBytes(normalizeSalt(keyInfo.salt))
    );
    if (shouldUseCache) {
      this.#keyCache.setKey(keyInfo.credentialId, secret);
      return { bytes: secret, release: () => undefined };
    }
    return { bytes: secret, release: () => this.#clearKey(secret) };
  }

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  #clearKey(key: Uint8Array): void {
    key?.fill?.(0);
  }
}
