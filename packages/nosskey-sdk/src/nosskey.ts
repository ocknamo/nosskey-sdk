import { seckeySigner } from '@rx-nostr/crypto';
import { KeyCache } from './key-cache.js';
import {
  DEFAULT_REGISTRY_STORAGE_KEY,
  loadRegistry,
  normalizeEntry,
  persistRegistry,
  removeEntry,
  upsertEntry,
} from './key-registry.js';
import { nip04Decrypt, nip04Encrypt } from './nip04.js';
import { nip44Decrypt, nip44Encrypt } from './nip44.js';
import { createPasskey, getPrfSecret, isPrfSupported } from './prf-handler.js';
import {
  STANDARD_SALT,
  STANDARD_SALT_BYTES,
  WRAP_SALT,
  WRAP_SALT_BYTES,
  normalizeSalt,
} from './salt.js';
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
    registryEnabled: true,
    registryStorageKey: DEFAULT_REGISTRY_STORAGE_KEY,
  };

  // マルチアカウント登録簿の in-memory キャッシュ。null は未ロード。
  // #currentKeyInfo と同様、storage 参照差し替え時に破棄して読み直す。
  #registryCache: NostrKeyInfo[] | null = null;

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
      // current だけでなく登録簿の in-memory キャッシュも破棄する。iframe で SAA grant 後に
      // partitioned 由来の登録簿を握り続けるのを防ぐ（ユーザー決定 #5）。
      this.#currentKeyInfo = null;
      this.#registryCache = null;
    }

    // ストレージが無効化された場合は保存済みの鍵情報を完全に削除する。
    // clearStoredKeyInfo は current スロットだけでなく登録簿も消すため、
    // 「ストレージ無効化＝全消去」の意図と整合する。
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
   * ストレージが有効な場合は current スロットへ保存する。
   * 登録簿が有効な場合は、あわせてエントリを upsert する（pubkey + credentialId 一意）。
   * これにより 2 つ目のアカウントを設定しても 1 つ目の wrap 暗号文が失われない。
   * @param keyInfo 設定するNostrKeyInfo
   */
  setCurrentKeyInfo(keyInfo: NostrKeyInfo): void {
    this.#currentKeyInfo = keyInfo;

    // ストレージが有効な場合は current スロットへ保存
    if (this.#storageOptions.enabled) {
      void this.#saveKeyInfoToStorage(keyInfo);
    }

    // 登録簿が有効な場合は upsert（current 上書きによる wrap 鍵喪失を防ぐ）
    if (this.#registryActive()) {
      const next = upsertEntry(this.#loadRegistry(), keyInfo);
      this.#persistRegistry(next);
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
   * 使用するストレージ（明示指定 > localStorage）を解決する。利用不可なら null。
   */
  #resolveStorage(): Storage | null {
    return (
      this.#storageOptions.storage || (typeof localStorage !== 'undefined' ? localStorage : null)
    );
  }

  /**
   * 登録簿のストレージキー。current スロット（storageKey）とは別キー。
   */
  #registryKey(): string {
    return this.#storageOptions.registryStorageKey || DEFAULT_REGISTRY_STORAGE_KEY;
  }

  /**
   * 登録簿が現在有効か（ストレージ有効かつ registryEnabled が false でない）。
   */
  #registryActive(): boolean {
    return this.#storageOptions.enabled && this.#storageOptions.registryEnabled !== false;
  }

  /**
   * 登録簿を読み込む（in-memory キャッシュ優先）。
   *
   * 登録簿キーがストレージに**存在しない**場合は未移行とみなし、current スロットに
   * 鍵があればそれを 1 件シードして移行する（一度きり）。空配列が保存されている場合は
   * 「移行済み・全削除済み」とみなしてシードしない（削除済みエントリを蘇生させない）。
   */
  #loadRegistry(): NostrKeyInfo[] {
    if (!this.#registryActive()) return [];
    if (this.#registryCache) return this.#registryCache;

    const storage = this.#resolveStorage();
    if (!storage) return [];

    const key = this.#registryKey();
    let list: NostrKeyInfo[];
    if (storage.getItem(key) === null) {
      // 未移行: current スロットの既存鍵をシードする。
      const current = this.getCurrentKeyInfo();
      list = current ? [normalizeEntry(current)] : [];
      if (list.length > 0) {
        persistRegistry(storage, key, list);
      }
    } else {
      list = loadRegistry(storage, key);
    }
    this.#registryCache = list;
    return list;
  }

  /**
   * 登録簿を in-memory キャッシュとストレージの両方へ反映する。
   */
  #persistRegistry(list: NostrKeyInfo[]): void {
    this.#registryCache = list;
    if (!this.#registryActive()) return;
    const storage = this.#resolveStorage();
    if (storage) persistRegistry(storage, this.#registryKey(), list);
  }

  /**
   * NostrKeyInfoをストレージに保存
   * @param keyInfo 保存するNostrKeyInfo
   */
  async #saveKeyInfoToStorage(keyInfo: NostrKeyInfo): Promise<void> {
    if (!this.#storageOptions.enabled) return;

    const storage = this.#resolveStorage();

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

    const storage = this.#resolveStorage();

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
   * 保存された鍵情報を**完全に消去**する（current スロット＋登録簿＋メモリ＋派生キャッシュ）。
   *
   * 秘密情報（wrap モードの暗号化 nsec を含む）をすべて削除する破壊的操作。wrap モードの
   * 鍵は復元不能になるため、共有端末からの完全サインアウトなど「すべて消す」意図のときに使う。
   * ログアウト（再ログインを残したい）には {@link clearCurrentKeyInfo} を使うこと。
   */
  clearStoredKeyInfo(): void {
    const storage = this.#resolveStorage();
    if (storage) {
      storage.removeItem(this.#storageOptions.storageKey || 'nosskey_keyinfo');
      // 登録簿（秘密情報の本体）も消去する。
      storage.removeItem(this.#registryKey());
    }

    // メモリ・登録簿キャッシュ・派生鍵キャッシュもすべて消去する。
    this.#currentKeyInfo = null;
    this.#registryCache = null;
    this.#keyCache.clearAllCachedKeys();
  }

  /**
   * ログアウト用: current ポインタ（単一スロット）とメモリ・派生キャッシュのみ消去する。
   * 登録簿は保持されるため、保存済みアカウント（特に復元不能な wrap モード鍵）から
   * 再ログインできる。
   */
  clearCurrentKeyInfo(): void {
    const storage = this.#resolveStorage();
    if (storage) {
      storage.removeItem(this.#storageOptions.storageKey || 'nosskey_keyinfo');
    }
    this.#currentKeyInfo = null;
    // 平文秘密鍵の派生キャッシュは破棄する（登録簿の暗号文は保持）。
    this.#keyCache.clearAllCachedKeys();
  }

  /**
   * 登録簿に保存されている全 NostrKeyInfo の一覧を返す（ディープコピー）。
   * 登録簿が無効な場合は空配列を返す。
   */
  listKeyInfos(): NostrKeyInfo[] {
    return this.#loadRegistry().map((k) => structuredClone(k));
  }

  /**
   * 登録簿から指定アカウント（pubkey + credentialId 一致）を削除する。
   * wrap モードのエントリを削除するとその暗号化 nsec は復元不能になる。
   * @param pubkey 公開鍵（hex）
   * @param credentialId クレデンシャルID（hex）
   */
  removeKeyInfo(pubkey: string, credentialId: string): void {
    if (!this.#registryActive()) return;
    const next = removeEntry(this.#loadRegistry(), pubkey, credentialId);
    this.#persistRegistry(next);
  }

  /**
   * バックアップ用に NostrKeyInfo を**ディープコピーして返す**（`wrapped.payload` を含む）。
   * 引数省略時は current 鍵を、指定時は登録簿の該当エントリを返す。該当が無ければ null。
   * 返り値を改変しても内部状態には影響しない。
   * @param pubkey 対象の公開鍵（hex）。省略時は current 鍵。
   * @param credentialId 同一 pubkey で複数エントリがある場合に特定するためのクレデンシャルID（hex）。
   */
  backupKeyInfo(pubkey?: string, credentialId?: string): NostrKeyInfo | null {
    let target: NostrKeyInfo | null;
    if (pubkey === undefined) {
      target = this.getCurrentKeyInfo();
    } else {
      target =
        this.#loadRegistry().find(
          (k) =>
            k.pubkey === pubkey && (credentialId === undefined || k.credentialId === credentialId)
        ) ?? null;
    }
    return target ? structuredClone(target) : null;
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
      const key = bytesToHex(result.id);
      // 同一 credentialId の古いエントリが残っている場合（リトライ・連続 create）は
      // バッファをゼロ化してから上書きする。これがないと前回 PRF が GC まで heap に残る。
      const existing = this.#pendingPrfByCredId.get(key);
      if (existing) {
        existing.standard?.fill(0);
        existing.wrap?.fill(0);
      }
      this.#pendingPrfByCredId.set(key, {
        ...(result.prfFirst && { standard: result.prfFirst }),
        ...(result.prfSecond && { wrap: result.prfSecond }),
      });
    }

    return result.id;
  }

  /**
   * #pendingPrfByCredId から指定 credentialId / kind の PRF を取り出して返す。
   *
   * 正常運用では create 直後に createNostrKey か importNostrKey の **どちらか一方** しか
   * 呼ばれないため、片方を消費したタイミングで「相方」のバッファも即時ゼロ化して
   * Map エントリごと削除する（未消費の秘匿バイトを heap に放置しない）。
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
    // 相方は今後使われない前提でゼロ化して破棄
    const other = kind === 'standard' ? 'wrap' : 'standard';
    entry[other]?.fill(0);
    this.#pendingPrfByCredId.delete(key);
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
    // 呼び出し側 seckey は成功・失敗・型違反のどの経路でも必ずゼロ化する
    // 契約にするため、入力検証も含めて 1 つの try/finally で覆う。
    // ただし Uint8Array でない場合は .fill() を呼べないので、その経路は
    // try の中で throw だけして finally では instanceof チェック越しに守る。
    try {
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
        // KEK をゼロ化（KEK は cachedKek 由来でも fetched 由来でも常に独立バッファ）
        kek.fill(0);
      }
    } finally {
      // 呼び出し側 seckey は型違反以外なら必ずゼロ化する
      if (seckey instanceof Uint8Array) {
        seckey.fill(0);
      }
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

    // export は平文 nsec を外部に露出するため、キャッシュ TTL 内でも必ず UV を要求する
    const sk = await this.#getSecretKey(effectiveKeyInfo, { bypassCache: true });
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
   * @param opts.bypassCache true のとき、キャッシュを読み書きせず必ず WebAuthn UV を
   *   要求する。平文 nsec を外部に露出する `exportNostrKey` はこのフラグを立てること。
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
    keyInfoOverride?: NostrKeyInfo,
    opts?: { bypassCache?: boolean }
  ): Promise<{ bytes: Uint8Array; release: () => void }> {
    const keyInfo = keyInfoOverride ?? this.getCurrentKeyInfo();
    if (!keyInfo) {
      throw new Error('No current NostrKeyInfo set');
    }
    const shouldUseCache = this.#keyCache.isEnabled() && !opts?.bypassCache;

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

        // 多層防御: 復号した nsec から導出した pubkey が、保存済み keyInfo.pubkey と
        // 一致するか検証する。pubkey は localStorage に平文・非認証で保存されるため、
        // 改ざんされると getPublicKey() が嘘の npub を返す（署名自体は seckey から
        // 再導出されるので正しく、表示 ID と署名鍵が食い違う）。別パスキー / 別 keyInfo
        // の取り違え検知にもなる。コストは pubkey 導出 1 回のみ。
        const derivedPubkey = await seckeySigner(nsecHex).getPublicKey();
        if (derivedPubkey !== keyInfo.pubkey) {
          nsec.fill(0);
          throw new Error(
            'Decrypted key does not match stored pubkey (NostrKeyInfo may be tampered)'
          );
        }
      } finally {
        // KEK は復号成否に関わらずゼロ化する。nsec は別バッファなので破壊しない
        // （pubkey 不一致で throw する経路では直前に nsec を個別ゼロ化済み）。
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
