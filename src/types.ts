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
  pubkey: string; // 公開鍵（hex形式）
  salt: string; // PRF導出用のsalt（hex形式、固定値 "6e6f7374722d6b6579"）
  username?: string; // パスキー作成時のユーザー名（取得可能な場合のみ）
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
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
  username?: string; // パスキー作成時のユーザー名
  prfOptions?: GetPrfSecretOptions; // PRF取得時のオプション
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
  /** 保存に使用するキー名（デフォルト: "nosskey_keyinfo"） */
  storageKey?: string;
}

/**
 * Sign options
 */
export interface SignOptions {
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
  tags?: string[][]; // 追加のタグ
  prfOptions?: GetPrfSecretOptions; // PRF取得時のオプション
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
   * ストレージが有効な場合は保存も行う
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
   * ストレージに保存されたNostrKeyInfoをクリア
   */
  clearStoredKeyInfo(): void;

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
}
