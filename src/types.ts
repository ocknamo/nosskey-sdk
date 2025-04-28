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
export interface PWKBlobV1 {
  v: 1;
  alg: 'aes-gcm-256';
  salt: string; // hex(16 B)
  iv: string; // hex(12 B)
  ct: string; // hex(32 B)
  tag: string; // hex(16 B)
  credentialId?: string; // クレデンシャルIDをhex形式で保存
}

/**
 * PWK blob - PRF直接使用方式 (PoC実装)
 */
export interface PWKBlobDirect {
  v: 1;
  alg: 'prf-direct';
  credentialId: string; // hex形式
}

export type PWKBlob = PWKBlobV1 | PWKBlobDirect;

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
  extensions?: Record<string, any>;
}

/**
 * Key options
 */
export interface KeyOptions {
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
}

/**
 * Create options (互換性のため残す)
 */
export interface CreateOptions {
  secretKey?: Uint8Array; // 外部から渡すシークレットキー（省略時は生成）
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
}

/**
 * Sign options
 */
export interface SignOptions {
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
  tags?: string[][]; // 追加のタグ
}

/**
 * Creation result
 */
export interface CreateResult {
  pwkBlob: PWKBlob; // 暗号化された秘密鍵
  credentialId: Uint8Array; // 生成されたクレデンシャルID
  publicKey: string; // 生成された公開鍵（hex）
}

/**
 * SDK public interface
 */
export interface PWKManagerLike {
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
   * @param credentialId 使用するクレデンシャルID
   * @param secretKey インポートする既存の秘密鍵
   * @param options オプション
   */
  importNostrKey(
    credentialId: Uint8Array,
    secretKey: Uint8Array,
    options?: KeyOptions
  ): Promise<CreateResult>;

  /**
   * 新しいNostr秘密鍵を生成してパスキーでラップ
   * @param credentialId 使用するクレデンシャルID
   * @param options オプション
   */
  generateNostrKey(credentialId: Uint8Array, options?: KeyOptions): Promise<CreateResult>;

  /**
   * PRF値を直接Nostrシークレットキーとして使用（PoC実装）
   * @param credentialId 使用するクレデンシャルID
   */
  directPrfToNostrKey(credentialId: Uint8Array): Promise<CreateResult>;

  /**
   * イベントに署名
   * @param event 署名するNostrイベント
   * @param pwk 暗号化された秘密鍵
   * @param credentialId 使用するクレデンシャルID
   * @param options 署名オプション
   */
  signEvent(
    event: NostrEvent,
    pwk: PWKBlob,
    credentialId: Uint8Array,
    options?: SignOptions
  ): Promise<NostrEvent>;

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  clearKey(key: Uint8Array): void;
}
