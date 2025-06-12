/**
 * Type definitions for Nosskey SDK
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
 * PWK blob structure (暗号化された秘密鍵の保存形式)
 */
export interface PWKBlobEncrypted {
  v: 1;
  alg: 'aes-gcm-256';
  salt: string; // hex(16 B)
  iv: string; // hex(12 B)
  ct: string; // hex(32 B)
  tag: string; // hex(16 B)
  credentialId: string; // クレデンシャルIDをhex形式で保存
  pubkey: string; // 公開鍵（hex形式）
  username?: string; // パスキー作成時のユーザー名（取得可能な場合のみ）
}

/**
 * PWK blob - PRF直接使用方式
 */
export interface PWKBlobDirect {
  v: 1;
  alg: 'prf-direct';
  credentialId: string; // hex形式
  pubkey: string; // 公開鍵（hex形式）
  username?: string; // パスキー作成時のユーザー名（取得可能な場合のみ）
}

export type PWKBlob = PWKBlobEncrypted | PWKBlobDirect;

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
 * PWK保存のためのオプション
 */
export interface PWKStorageOptions {
  /** PWKの保存を有効にするか（デフォルト: true） */
  enabled: boolean;
  /** 使用するストレージ（デフォルト: localStorage） */
  storage?: Storage;
  /** 保存に使用するキー名（デフォルト: "nosskey_pwk"） */
  storageKey?: string;
}

/**
 * Sign options
 */
export interface SignOptions {
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
  tags?: string[][]; // 追加のタグ
}

/**
 * SDK public interface
 */
export interface PWKManagerLike {
  /**
   * NIP-07互換: 公開鍵を取得
   * 現在設定されているPWKから公開鍵を返す
   */
  getPublicKey(): Promise<string>;

  /**
   * NIP-07互換: イベント署名
   * 現在設定されているPWKでイベントに署名
   * @param event 署名するNostrイベント
   */
  signEvent(event: NostrEvent): Promise<NostrEvent>;

  /**
   * 現在のPWKを設定
   * ストレージが有効な場合は保存も行う
   * @param pwk 設定するPWK
   */
  setCurrentPWK(pwk: PWKBlob): void;

  /**
   * 現在のPWKを取得
   * 未設定の場合はストレージからの読み込みを試みる
   */
  getCurrentPWK(): PWKBlob | null;

  /**
   * PWKが存在するかどうかを確認
   * ストレージの設定に応じてメモリやストレージから検索
   * @returns PWKが存在するかどうか
   */
  hasPWK(): boolean;

  /**
   * PWKストレージの設定を更新
   * @param options ストレージオプション
   */
  setStorageOptions(options: Partial<PWKStorageOptions>): void;

  /**
   * 現在のPWKストレージ設定を取得
   */
  getStorageOptions(): PWKStorageOptions;

  /**
   * ストレージに保存されたPWKをクリア
   */
  clearStoredPWK(): void;

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
   * 既存のNostr秘密鍵をパスキーでラップして保護
   * @param secretKey インポートする既存の秘密鍵
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  importNostrKey(
    secretKey: Uint8Array,
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<PWKBlob>;

  /**
   * 新しいNostr秘密鍵を生成してパスキーでラップ
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  generateNostrKey(credentialId?: Uint8Array, options?: KeyOptions): Promise<PWKBlob>;

  /**
   * PRF値を直接Nostrシークレットキーとして使用（PoC実装）
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  directPrfToNostrKey(credentialId?: Uint8Array, options?: KeyOptions): Promise<PWKBlob>;

  /**
   * イベントに署名
   * @param event 署名するNostrイベント
   * @param pwk 暗号化された秘密鍵またはPRF直接使用（credentialIdを含む）
   * @param options 署名オプション
   */
  signEventWithPWK(event: NostrEvent, pwk: PWKBlob, options?: SignOptions): Promise<NostrEvent>;

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
   * 暗号化された秘密鍵をエクスポート
   * @param pwk PWKBlob形式の暗号化された秘密鍵
   * @param credentialId 使用するクレデンシャルID（省略時はPWKBlobのcredentialIdから取得、またはユーザーが選択したパスキーが使用される）
   * @returns エクスポートされた秘密鍵（16進数文字列）
   */
  exportNostrKey(pwk: PWKBlob, credentialId?: Uint8Array): Promise<string>;
}
