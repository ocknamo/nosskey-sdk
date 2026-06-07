/**
 * Type definitions for Nosskey SDK (PRF Direct Usage Only)
 * @packageDocumentation
 */

/**
 * Nostr event JSON
 */
export interface NostrEvent {
  id?: string; // sha256 hash of serialized event
  pubkey?: string; // hex
  created_at?: number;
  kind: number;
  tags?: string[][];
  content: string;
  sig?: string; // hex
}

/**
 * Nostr key information (PRF直接使用方式のみ)
 * PWKBlobを廃止し、シンプルなキー情報のみ保持
 */
export interface NostrKeyInfo {
  credentialId: string; // クレデンシャルIDをhex形式で保存
  pubkey: string; // 公開鍵（hex形式）。wrapモードでは「インポートされた鍵」の公開鍵（KEK・GではなくユーザのNostr公開鍵）。
  salt: string; // PRF評価入力として使うsalt（hex形式）。PRF直接モード: "6e6f7374722d70776b" / wrapモード: "6e6f7374722d70776b2d77726170"
  username?: string; // パスキー作成時のユーザー名（取得可能な場合のみ）
  /**
   * wrap モードのメタデータ。
   * - undefined の場合は PRF 直接モード（PRF出力をそのまま秘密鍵として使用）
   * - 設定されている場合は wrap モード（PRF 由来 KEK で nsec を NIP-44 v2 暗号化して保存）
   */
  wrapped?: {
    v: 1; // データ形式バージョン
    alg: 'nip44-v2'; // 暗号方式識別子
    payload: string; // nip44Encrypt 戻り値（base64 エンコードされた NIP-44 v2 ペイロード）
  };
}

/**
 * パスキー作成用オプション
 */
export interface PasskeyCreationOptions {
  rp?: {
    name?: string;
    id?: string;
  };
  user?: {
    name?: string;
    displayName?: string;
  };
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  pubKeyCredParams?: PublicKeyCredentialParameters[];
  extensions?: Record<string, unknown>;
}

/**
 * Key options
 */
export interface KeyOptions {
  username?: string; // パスキー作成時のユーザー名
}

/**
 * PRF secret取得のためのオプション
 */
export interface GetPrfSecretOptions {
  /** Relying Party ID */
  rpId?: string;
  /** タイムアウト時間（ミリ秒） */
  timeout?: number;
  /** ユーザー検証要件 */
  userVerification?: UserVerificationRequirement;
  /**
   * パスキー作成時の residentKey 要件（createPasskey 時のみ使用）。
   * Android Chrome の Credential Manager で Google Password Manager を
   * 候補プロバイダに出すためには 'required' が必須。
   */
  residentKey?: ResidentKeyRequirement;
  /**
   * パスキー作成時の requireResidentKey 要件（createPasskey 時のみ使用）。
   * WebAuthn L2 以前の実装は residentKey ではなくこちらを見るため新旧併用。
   */
  requireResidentKey?: boolean;
}

/**
 * キャッシュオプションの型定義
 */
export interface KeyCacheOptions {
  /** キャッシュを有効にするかどうか */
  enabled: boolean;
  /** キャッシュの有効期限（ミリ秒） */
  timeoutMs?: number;
}

/**
 * NostrKeyInfo保存のためのオプション
 */
export interface NostrKeyStorageOptions {
  /** NostrKeyInfoの保存を有効にするか（デフォルト: true） */
  enabled: boolean;
  /** 使用するストレージ（デフォルト: localStorage） */
  storage?: Storage;
  /** current 鍵（単一スロット）の保存に使用するキー名（デフォルト: "nosskey_keyinfo"） */
  storageKey?: string;
  /**
   * マルチアカウント登録簿を有効にするか（デフォルト: true）。
   * 有効な場合、`setCurrentKeyInfo()` は current スロットへの書き込みに加えて
   * `registryStorageKey` の登録簿へエントリを upsert する。これにより current 上書きや
   * logout（`clearCurrentKeyInfo()`）後も、復元不能な wrap モードの暗号化 nsec が
   * 失われず再ログインできる。`false` にすると登録簿を一切読み書きしない旧挙動になる。
   */
  registryEnabled?: boolean;
  /** 登録簿の保存に使用するキー名（デフォルト: "nosskey_accounts"）。`storageKey` とは別キー。 */
  registryStorageKey?: string;
}

/**
 * Sign options
 */
export interface SignOptions {
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
  tags?: string[][]; // 追加のタグ
}

/**
 * NosskeyManager コンストラクタオプション
 */
export interface NosskeyManagerOptions {
  /** キャッシュオプション */
  cacheOptions?: Partial<KeyCacheOptions>;
  /** ストレージオプション */
  storageOptions?: Partial<NostrKeyStorageOptions>;
  /** PRF取得時のオプション */
  prfOptions?: GetPrfSecretOptions;
}

/**
 * SDK public interface
 */
export interface NosskeyManagerLike {
  /**
   * NIP-07互換: 公開鍵を取得
   * 現在設定されているNostrKeyInfoから公開鍵を返す
   */
  getPublicKey(): Promise<string>;

  /**
   * NIP-07互換: イベント署名
   * 現在設定されているNostrKeyInfoでイベントに署名
   * @param event 署名するNostrイベント
   */
  signEvent(event: NostrEvent): Promise<NostrEvent>;

  /**
   * 現在のNostrKeyInfoを設定
   * ストレージが有効な場合は current スロットへ保存する。
   * 登録簿が有効な場合は、あわせてエントリを upsert する（pubkey + credentialId 一意）。
   * @param keyInfo 設定するNostrKeyInfo
   */
  setCurrentKeyInfo(keyInfo: NostrKeyInfo): void;

  /**
   * 現在のNostrKeyInfoを取得
   * 未設定の場合はストレージからの読み込みを試みる
   */
  getCurrentKeyInfo(): NostrKeyInfo | null;

  /**
   * NostrKeyInfoが存在するかどうかを確認
   * ストレージの設定に応じてメモリやストレージから検索
   * @returns NostrKeyInfoが存在するかどうか
   */
  hasKeyInfo(): boolean;

  /**
   * NostrKeyInfoストレージの設定を更新
   * @param options ストレージオプション
   */
  setStorageOptions(options: Partial<NostrKeyStorageOptions>): void;

  /**
   * 現在のNostrKeyInfoストレージ設定を取得
   */
  getStorageOptions(): NostrKeyStorageOptions;

  /**
   * 保存された鍵情報を**完全に消去**する（current スロット＋登録簿＋メモリ＋派生キャッシュ）。
   *
   * 秘密情報（wrap モードの暗号化 nsec を含む）をすべて削除する破壊的操作。
   * wrap モードの鍵は復元不能になるため、共有端末からの完全サインアウトなど
   * 「すべて消す」意図のときに使う。
   *
   * ログアウト（一時的に current を外すが再ログインは残す）には
   * `clearCurrentKeyInfo()` を使うこと。
   */
  clearStoredKeyInfo(): void;

  /**
   * ログアウト用: current ポインタ（単一スロット）とメモリ・派生キャッシュのみ消去する。
   * 登録簿は保持されるため、保存済みアカウント（特に復元不能な wrap モード鍵）から
   * 再ログインできる。
   */
  clearCurrentKeyInfo(): void;

  /**
   * 登録簿に保存されている全 NostrKeyInfo の一覧を返す（ディープコピー）。
   * 登録簿が無効な場合は空配列を返す。
   */
  listKeyInfos(): NostrKeyInfo[];

  /**
   * 登録簿から指定アカウント（pubkey + credentialId 一致）を削除する。
   * wrap モードのエントリを削除するとその暗号化 nsec は復元不能になる。
   * @param pubkey 公開鍵（hex）
   * @param credentialId クレデンシャルID（hex）
   */
  removeKeyInfo(pubkey: string, credentialId: string): void;

  /**
   * バックアップ用に NostrKeyInfo を**ディープコピーして返す**（`wrapped.payload` を含む）。
   * 引数省略時は current 鍵を、指定時は登録簿の該当エントリを返す。該当が無ければ null。
   * 返り値を改変しても内部状態には影響しない。
   * @param pubkey 対象の公開鍵（hex）。省略時は current 鍵。
   * @param credentialId 同一 pubkey で複数エントリがある場合に特定するためのクレデンシャルID（hex）。
   */
  backupKeyInfo(pubkey?: string, credentialId?: string): NostrKeyInfo | null;

  /**
   * PRF拡張機能がサポートされているかチェック
   */
  isPrfSupported(): Promise<boolean>;

  /**
   * パスキーを作成（PRF拡張もリクエスト）
   * @param options パスキー作成オプション
   * @returns Credentialの識別子を返す
   */
  createPasskey(options?: PasskeyCreationOptions): Promise<Uint8Array>;

  /**
   * PRF値を直接Nostrシークレットキーとして使用してNostrKeyInfoを作成
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  createNostrKey(credentialId?: Uint8Array, options?: KeyOptions): Promise<NostrKeyInfo>;

  /**
   * 既存の Nostr 秘密鍵（nsec）を PRF 由来 KEK で NIP-44 v2 暗号化して保存する（wrap モード）。
   *
   * 入力された seckey は SDK 内部で NIP-44 v2 自己宛 DM パターンで暗号化され、
   * 暗号化済みペイロードが NostrKeyInfo.wrapped.payload に格納される。
   * 完了時に呼び出し側から渡された seckey バッファは内部で 0 埋めされる。
   *
   * @param seckey 32 バイトの Nostr 秘密鍵（生バイト）
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   * @returns wrapped フィールドを含む NostrKeyInfo
   */
  importNostrKey(
    seckey: Uint8Array,
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<NostrKeyInfo>;

  /**
   * イベントに署名
   * @param event 署名するNostrイベント
   * @param keyInfo NostrKeyInfo
   * @param options 署名オプション
   */
  signEventWithKeyInfo(
    event: NostrEvent,
    keyInfo: NostrKeyInfo,
    options?: SignOptions
  ): Promise<NostrEvent>;

  /**
   * キャッシュ設定を更新
   * @param options キャッシュオプション
   */
  setCacheOptions(options: Partial<KeyCacheOptions>): void;

  /**
   * 現在のキャッシュ設定を取得
   */
  getCacheOptions(): KeyCacheOptions;

  /**
   * 特定の鍵のキャッシュをクリア
   * @param credentialId クレデンシャルID
   */
  clearCachedKey(credentialId: Uint8Array | string): void;

  /**
   * 全てのキャッシュをクリア
   */
  clearAllCachedKeys(): void;

  /**
   * 秘密鍵をエクスポート
   * @param keyInfo NostrKeyInfo
   * @param credentialId 使用するクレデンシャルID（省略時はNostrKeyInfoのcredentialIdから取得、またはユーザーが選択したパスキーが使用される）
   * @param options オプション
   * @returns エクスポートされた秘密鍵（16進数文字列）
   */
  exportNostrKey(
    keyInfo: NostrKeyInfo,
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<string>;

  /**
   * NIP-44 v2 で平文を暗号化
   * @param peerPubkey 相手の公開鍵（hex, 32 bytes）
   * @param plaintext 平文
   * @returns base64 エンコードされた NIP-44 v2 ペイロード
   */
  nip44Encrypt(peerPubkey: string, plaintext: string): Promise<string>;

  /**
   * NIP-44 v2 ペイロードを復号
   * @param peerPubkey 相手の公開鍵（hex, 32 bytes）
   * @param ciphertext base64 エンコードされた NIP-44 v2 ペイロード
   */
  nip44Decrypt(peerPubkey: string, ciphertext: string): Promise<string>;

  /**
   * NIP-04 で平文を暗号化（レガシー DM）
   * @param peerPubkey 相手の公開鍵（hex, 32 bytes）
   * @param plaintext 平文
   * @returns NIP-04 ペイロード（`<base64(ct)>?iv=<base64(iv)>`）
   */
  nip04Encrypt(peerPubkey: string, plaintext: string): Promise<string>;

  /**
   * NIP-04 ペイロードを復号
   * @param peerPubkey 相手の公開鍵（hex, 32 bytes）
   * @param ciphertext NIP-04 ペイロード
   */
  nip04Decrypt(peerPubkey: string, ciphertext: string): Promise<string>;
}
