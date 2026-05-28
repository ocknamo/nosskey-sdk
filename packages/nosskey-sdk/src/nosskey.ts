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

// wrap モード用 salt 値（"nostr-pwk-wrap"のUTF-8バイトのhex）。PRF 直接モードと
// ドメイン分離するため、wrap モードでは異なる salt から KEK を導出する。
const WRAP_SALT = '6e6f7374722d70776b2d77726170';

// PRF eval に渡す salt のバイト表現。createPasskey 時に first/second 両方を eval して
// 「直接モード用 PRF」と「wrap モード用 KEK」を 1 回の UV で同時取得するため。
const STANDARD_SALT_BYTES = hexToBytes(STANDARD_SALT);
const WRAP_SALT_BYTES = hexToBytes(WRAP_SALT);

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

  // createPasskey 時に二重 salt eval して得た PRF を、直後の createNostrKey /
  // importNostrKey が一度だけ消費する用の内部キャッシュ。
  // - key: credentialId (hex)
  // - standard: STANDARD_SALT 由来 PRF（直接モード鍵 / createNostrKey が使う）
  // - wrap: WRAP_SALT 由来 PRF（wrap モード KEK / importNostrKey が使う）
  // 消費時は即ゼロ化 + Map から削除する（同じパスキーでもう一度 derive したい場合は
  // 通常通り getPrfSecret() 経由で UV を要求する）。
  #pendingPrfByCredId = new Map<string, { standard?: Uint8Array; wrap?: Uint8Array }>();

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
    const residentKey = options?.prfOptions?.residentKey ?? 'required';
    const requireResidentKey = options?.prfOptions?.requireResidentKey ?? true;
    if (options?.prfOptions) {
      this.#prfOptions = {
        ...options.prfOptions,
        userVerification,
        residentKey,
        requireResidentKey,
      };
    } else {
      this.#prfOptions = { userVerification, residentKey, requireResidentKey };
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
    try {
      storage.setItem(key, JSON.stringify(keyInfo));
    } catch (e) {
      // 書き込み失敗（容量超過など）は致命的ではないため、ログのみで握り潰す。
      // async メソッドのため、握り潰さないと void 呼び出し側で unhandled rejection になる。
      console.error('Failed to persist NostrKeyInfo', e);
    }
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
   *
   * 内部実装としては create 時に `extensions.prf.eval.first/second` で
   * 標準 salt と wrap salt の両方を同時に eval し、得られた PRF を
   * #pendingPrfByCredId に保存する。直後の `createNostrKey()` / `importNostrKey()`
   * はこのキャッシュを優先的に消費するので、通常フローでは UV が 1 回で済む。
   * 特に Android Chrome では create 直後の get() が `NotReadableError` で
   * 落ちる既知挙動があり、その回避が主目的。
   *
   * @param options パスキー作成オプション。なければコンストラクタで設定された値を設定する。
   * @returns Credentialの識別子を返す
   */
  async createPasskey(options: PasskeyCreationOptions = {}): Promise<Uint8Array> {
    const result = await createPasskey(
      {
        rp: {
          id: this.#prfOptions.rpId,
          name: this.#prfOptions.rpId,
        },
        authenticatorSelection: {
          // 既定値は #prfOptions 側でコンストラクタ時に解決済み
          // （residentKey='required' / requireResidentKey=true / userVerification='required'）。
          // これらは Android Chrome の Credential Manager で Google Password
          // Manager を候補プロバイダに出すための条件として必須。
          residentKey: this.#prfOptions.residentKey,
          requireResidentKey: this.#prfOptions.requireResidentKey,
          userVerification: this.#prfOptions.userVerification,
        },
        ...options,
      },
      { first: STANDARD_SALT_BYTES, second: WRAP_SALT_BYTES }
    );

    // create 時に PRF が返ってきていればキャッシュに退避（消費は createNostrKey /
    // importNostrKey 側で行う）。返ってこない環境では従来どおり get() フォールバック。
    if (result.prfFirst || result.prfSecond) {
      this.#pendingPrfByCredId.set(bytesToHex(result.id), {
        ...(result.prfFirst && { standard: result.prfFirst }),
        ...(result.prfSecond && { wrap: result.prfSecond }),
      });
    }

    return result.id;
  }

  /**
   * #pendingPrfByCredId から指定 credentialId / kind の PRF を取り出して返す。
   * 取得後はキャッシュから削除し、エントリが空になったら Map ごと掃除する。
   * credentialId が undefined（= ユーザー選択待ち）の場合はキャッシュ照合できないので undefined を返す。
   */
  #consumePendingPrf(
    credentialId: Uint8Array | undefined,
    kind: 'standard' | 'wrap'
  ): Uint8Array | undefined {
    if (!credentialId) return undefined;
    const key = bytesToHex(credentialId);
    const entry = this.#pendingPrfByCredId.get(key);
    if (!entry) return undefined;
    const value = entry[kind];
    if (!value) return undefined;
    entry[kind] = undefined;
    if (!entry.standard && !entry.wrap) {
      this.#pendingPrfByCredId.delete(key);
    }
    return value;
  }

  /**
   * PRF値を直接Nostrシークレットキーとして使用してNostrKeyInfoを作成
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async createNostrKey(credentialId?: Uint8Array, options: KeyOptions = {}): Promise<NostrKeyInfo> {
    // createPasskey 直後で同じ credentialId に対する standard PRF が
    // キャッシュされていればそれを消費する。無ければ getPrfSecret() に
    // フォールバック（= 既存パスキーで再導出するケース、または create 時に
    // PRF が返らない環境）。
    const cached = this.#consumePendingPrf(credentialId, 'standard');
    let sk: Uint8Array;
    let responseId: Uint8Array;
    if (cached) {
      sk = cached;
      responseId = credentialId as Uint8Array;
    } else {
      const fetched = await getPrfSecret(credentialId, this.#prfOptions, STANDARD_SALT_BYTES);
      sk = fetched.secret;
      responseId = fetched.id;
    }

    try {
      // secp256k1の有効範囲チェック(ここでは0チェックのみ)
      if (sk.every((byte) => byte === 0)) {
        throw new Error('Invalid PRF output: all zeros');
      }

      // 秘密鍵HEX文字列を取得して公開鍵を導出
      // (skHex は JS の string なので fill(0) で消せない既知の制限あり)
      const skHex = bytesToHex(sk);
      const signer = seckeySigner(skHex);
      const publicKey = await signer.getPublicKey();

      return {
        credentialId: bytesToHex(credentialId || responseId),
        pubkey: publicKey,
        salt: STANDARD_SALT,
        ...(options.username && { username: options.username }),
      };
    } finally {
      // 使い終わった PRF をゼロ化（キャッシュからの消費分は即破棄、
      // getPrfSecret 由来分は呼び出し側責任で破棄するという既存仕様の補強）。
      sk.fill(0);
    }
  }

  /**
   * 既存の Nostr 秘密鍵（nsec）を PRF 由来 KEK で NIP-44 v2 暗号化して NostrKeyInfo を作成（wrap モード）。
   *
   * NIP-44 v2 自己宛 DM パターン: ourSk = KEK / peerPk = KEK·G として nsec を暗号化する。
   * 復号時にも同じ KEK を PRF から取り出し、同じ KEK·G を peer 公開鍵として使うため
   * 鍵管理上の追加情報は不要（wrapped.payload のみで完結する）。
   *
   * @param seckey 32 バイトの Nostr 秘密鍵
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async importNostrKey(
    seckey: Uint8Array,
    credentialId?: Uint8Array,
    options: KeyOptions = {}
  ): Promise<NostrKeyInfo> {
    // 入力検証: 32 バイトの Uint8Array であること
    if (!(seckey instanceof Uint8Array) || seckey.length !== 32) {
      throw new Error('importNostrKey: seckey must be a 32-byte Uint8Array');
    }
    if (seckey.every((b) => b === 0)) {
      throw new Error('importNostrKey: invalid seckey (all zeros)');
    }

    // createPasskey 直後で同じ credentialId に対する wrap PRF が
    // キャッシュされていればそれを KEK として消費する。無ければ getPrfSecret()
    // にフォールバック（= 既存パスキーで wrap し直すケース、または create 時に
    // PRF が返らない環境）。
    const cachedKek = this.#consumePendingPrf(credentialId, 'wrap');
    let kek: Uint8Array;
    let responseId: Uint8Array;
    if (cachedKek) {
      kek = cachedKek;
      responseId = credentialId as Uint8Array;
    } else {
      const fetched = await getPrfSecret(credentialId, this.#prfOptions, WRAP_SALT_BYTES);
      kek = fetched.secret;
      responseId = fetched.id;
    }

    try {
      if (kek.every((b) => b === 0)) {
        throw new Error('Invalid PRF output: all zeros');
      }

      const kekHex = bytesToHex(kek);
      const kekPubkey = await seckeySigner(kekHex).getPublicKey();

      const seckeyHex = bytesToHex(seckey);
      const importedPubkey = await seckeySigner(seckeyHex).getPublicKey();

      // 自己宛 DM パターンで暗号化: 平文 = nsec hex / ourSk = KEK / peerPk = KEK·G
      const payload = nip44Encrypt(seckeyHex, kek, kekPubkey);

      return {
        credentialId: bytesToHex(credentialId || responseId),
        pubkey: importedPubkey,
        salt: WRAP_SALT,
        ...(options.username && { username: options.username }),
        wrapped: { v: 1, alg: 'nip44-v2', payload },
      };
    } finally {
      // KEK と nsec 入力バッファをゼロ化（呼び出し側でも前後ゼロ化推奨）
      kek.fill(0);
      seckey.fill(0);
    }
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
    // credentialId が明示指定された場合のみ keyInfo.credentialId を差し替える
    // （wrap モードでも直接モードでも #getSecretKey が透過的に処理する）
    const effectiveKeyInfo = credentialId
      ? { ...keyInfo, credentialId: bytesToHex(credentialId) }
      : keyInfo;

    const sk = await this.#getSecretKey(effectiveKeyInfo);
    try {
      return bytesToHex(sk.bytes);
    } finally {
      sk.release();
    }
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

    // 1) キャッシュヒット → 平文 nsec をそのまま返す（wrap/直接モード共通）
    if (shouldUseCache) {
      const cached = this.#keyCache.getKey(keyInfo.credentialId);
      if (cached) {
        return { bytes: cached, release: () => undefined };
      }
    }

    // 2) PRF を取得（直接モード: PRF出力がそのまま nsec / wrap モード: PRF出力が KEK）
    const { secret: prf } = await getPrfSecret(
      hexToBytes(keyInfo.credentialId),
      this.#prfOptions,
      hexToBytes(normalizeSalt(keyInfo.salt))
    );

    // 3) wrap モード分岐: NIP-44 v2 復号で平文 nsec を取り出す
    let nsec: Uint8Array;
    if (keyInfo.wrapped) {
      if (keyInfo.wrapped.alg !== 'nip44-v2') {
        prf.fill(0);
        throw new Error(`Unsupported wrap algorithm: ${keyInfo.wrapped.alg}`);
      }
      try {
        const kekPubkey = await seckeySigner(bytesToHex(prf)).getPublicKey();
        const nsecHex = nip44Decrypt(keyInfo.wrapped.payload, prf, kekPubkey);
        nsec = hexToBytes(nsecHex);
      } finally {
        // KEK は復号成否に関わらずゼロ化（nsec は別バッファなので破壊しない）
        prf.fill(0);
      }
    } else {
      // PRF 直接モード: prf がそのまま nsec として扱われる（同一バッファ参照）
      nsec = prf;
    }

    // 4) キャッシュ保存 / release ハンドラ
    if (shouldUseCache) {
      this.#keyCache.setKey(keyInfo.credentialId, nsec);
      if (keyInfo.wrapped) {
        // wrap モードのみ: KeyCache がコピーを持つので元バッファは即ゼロ化
        nsec.fill(0);
      }
      const cached = this.#keyCache.getKey(keyInfo.credentialId);
      if (!cached) {
        throw new Error('Internal error: KeyCache lost just-stored key');
      }
      return { bytes: cached, release: () => undefined };
    }
    return { bytes: nsec, release: () => this.#clearKey(nsec) };
  }

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  #clearKey(key: Uint8Array): void {
    key?.fill?.(0);
  }
}
