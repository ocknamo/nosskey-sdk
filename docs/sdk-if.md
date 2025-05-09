# Passkey-Wrapped Key (PWK) NIP - TypeScript SDK 実装

**NIP-49を採用しないシンプルな実装例**

このSDK実装はNIP-49で規定されているscryptやXChaCha20-Poly1305を使用せず、WebAuthnのPRF拡張から得られる高エントロピー値を直接AES-GCM暗号化に利用するシンプルなアプローチを採用しています。これにより、追加ライブラリの依存なしに標準Web Crypto APIのみで実装可能で、優れたパフォーマンスを実現しています。

## 概要

このドキュメントでは、Passkey-Wrapped Key (PWK) NIPのTypeScript SDK実装に関するインターフェース設計と重要なメソッドの実装例を紹介します。

**注意**: このSDKは本番環境向けに完成されたものではなく、エッジケース処理、UXプロンプト、失効処理、および完全な暗号強化は省略されています。主に以下を示しています：

- 公開インターフェース（型とクラス）
- 主要メソッド：`createPasskey()`, `importNostrKey()`, `generateNostrKey()`, `directPrfToNostrKey()`, `signEventWithPWK()`, `isPrfSupported()`の実装
- 使用例

## 1. 公開インターフェースと型定義

```typescript
/**
 * Nostr event JSON (simplified)
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
 * Sign options
 */
export interface SignOptions {
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
  tags?: string[][]; // 追加のタグ
  /** 秘密鍵をキャッシュするかどうか。指定がない場合はグローバル設定に従う */
  useCache?: boolean;
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
  generateNostrKey(
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<PWKBlob>;

  /**
   * PRF値を直接Nostrシークレットキーとして使用（PoC実装）
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  directPrfToNostrKey(
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<PWKBlob>;

  /**
   * イベントに署名
   * @param event 署名するNostrイベント
   * @param pwk 暗号化された秘密鍵またはPRF直接使用（credentialIdを含む）
   * @param options 署名オプション
   */
  signEventWithPWK(
    event: NostrEvent,
    pwk: PWKBlob,
    options?: SignOptions
  ): Promise<NostrEvent>;

  /**
   * 暗号化された秘密鍵をエクスポート
   * @param pwk PWKBlob形式の暗号化された秘密鍵
   * @param credentialId 使用するクレデンシャルID（省略時はPWKBlobのcredentialIdから取得、またはユーザーが選択したパスキーが使用される）
   * @returns エクスポートされた秘密鍵（16進数文字列）
   */
  exportNostrKey(pwk: PWKBlob, credentialId?: Uint8Array): Promise<string>;

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  clearKey(key: Uint8Array): void;

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
}
```

## 2. 実装クラス概略

```typescript
export class PWKManager implements PWKManagerLike {
  /**
   * PRF拡張機能がサポートされているかチェック
   */
  async isPrfSupported(): Promise<boolean>;

  /**
   * パスキーを作成（PRF拡張もリクエスト）
   * @param options パスキー作成オプション
   * @returns Credentialの識別子を返す
   */
  async createPasskey(options?: PasskeyCreationOptions): Promise<Uint8Array>;

  /**
   * 既存のNostr秘密鍵をパスキーでラップして保護
   * @param secretKey インポートする既存の秘密鍵
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async importNostrKey(
    secretKey: Uint8Array,
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<CreateResult>;

  /**
   * 新しいNostr秘密鍵を生成してパスキーでラップ
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   * @param options オプション
   */
  async generateNostrKey(
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<CreateResult>;

  /**
   * PRF値を直接Nostrシークレットキーとして使用（PoC実装）
   * @param credentialId 使用するクレデンシャルID（省略時はユーザーが選択したパスキーが使用される）
   */
  async directPrfToNostrKey(
    credentialId?: Uint8Array
  ): Promise<CreateResult>;

  /**
   * イベントに署名
   * @param event 署名するNostrイベント
   * @param pwk 暗号化された秘密鍵またはPRF直接使用（credentialIdを含む）
   * @param options 署名オプション
   */
  async signEventWithPWK(
    event: NostrEvent,
    pwk: PWKBlob,
    options?: SignOptions
  ): Promise<NostrEvent>;

  /**
   * 暗号化された秘密鍵をエクスポート
   * @param pwk PWKBlob形式の暗号化された秘密鍵
   * @param credentialId 使用するクレデンシャルID（省略時はPWKBlobのcredentialIdから取得、またはユーザーが選択したパスキーが使用される）
   */
  async exportNostrKey(pwk: PWKBlob, credentialId?: Uint8Array): Promise<string>;

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  clearKey(key: Uint8Array): void;
  
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
}
```

## 3. 使用例

### 3.1 パスキー作成と既存Nostr鍵のインポート

```typescript
const pwkMgr = new PWKManager();

// PRF拡張対応チェック
if (await pwkMgr.isPrfSupported()) {
  try {
    // ステップ1: パスキーの作成（ここでユーザー認証UI表示）
    const credentialId = await pwkMgr.createPasskey();
    localStorage.setItem('pwkCredId', bytesToHex(credentialId));
    
    // ステップ2: 既存のNostr秘密鍵をインポート
    // (例: nsecから復元した秘密鍵またはアプリ内部で管理している鍵)
    const existingSecretKey = hexToBytes('7f...'); // 32バイトの秘密鍵
    
    const result = await pwkMgr.importNostrKey(existingSecretKey, credentialId);
    localStorage.setItem('pwkBlob', JSON.stringify(result.pwkBlob));
    console.log(`公開鍵: ${result.publicKey}`);
    
  } catch (e) {
    console.error('パスキー処理エラー:', e);
  }
}
```

### 3.2 新しいNostr鍵の生成

```typescript
// 新しいNostr鍵を生成
try {
  const credentialId = hexToBytes(localStorage.getItem('pwkCredId'));
  
  // 新しいランダムなNostr秘密鍵を生成
  const result = await pwkMgr.generateNostrKey(credentialId);
  localStorage.setItem('pwkBlob', JSON.stringify(result.pwkBlob));
  console.log(`新しい公開鍵: ${result.publicKey}`);
} catch (e) {
  console.error('鍵生成エラー:', e);
}
```

### 3.3 PRF値を直接Nostrシークレットキーとして使用（PoC）

```typescript
// PRF値を直接シークレットキーとして使用
try {
  const credentialId = hexToBytes(localStorage.getItem('pwkCredId'));
  
  // PRF値を直接Nostrキーとして使用
  const directResult = await pwkMgr.directPrfToNostrKey(credentialId);
  localStorage.setItem('directPwkBlob', JSON.stringify(directResult.pwkBlob));
  console.log(`PRF直接使用による公開鍵: ${directResult.publicKey}`);
  
  // イベントに署名
  const event = {
    kind: 1,
    content: 'PRF直接使用テスト',
    tags: [],
    created_at: Math.floor(Date.now() / 1000)
  };
  const signedEvent = await pwkMgr.signEventWithPWK(
    event, 
    directResult.pwkBlob
  );
  console.log('署名されたイベント:', signedEvent);
  
} catch (e) {
  console.error('PRF直接使用エラー:', e);
}
```

## 4. 注意点と落とし穴

| 項目 | 説明 |
|------|------|
| PWKブロブの保管 | 暗号化された秘密鍵（PWKブロブ）は通常のNostr秘密鍵と同様に安全に保管する必要があります。紛失した場合はNostr秘密鍵も同様に失われます。 |
| メモリ消去 | Web Cryptoバッファはガベージコレクションで切り離されますが、Uint8Arraysに対するexplicit fill(0)はまだ慎重に行うべきです。 |
| Windows | Windows Hello（2025-04）はPRF拡張をサポートしていない場合があります。その場合、モバイル端末のパスキーを使用するなどの代替手段をユーザーに案内すると良いでしょう。なお、多くの場合はブラウザのパスキーUIが適切に案内します。 |
| PRF値の有効性 | PRF値を直接シークレットキーとして使用する場合、secp256k1の有効範囲に入らない可能性があります（確率は極めて低い）。 |
| バックアップ | 暗号化されたPWKブロブをデバイス外（kind 10060など）に保存し、追加のパスキーで復元できるようにすることが推奨されます。 |

## 5. 実装ポイント

### 5.1 インターフェース設計の特徴

| メソッド | 主な目的 | 用途 |
|---------|---------|------|
| createPasskey() | パスキーのみ作成 | パスキー登録（UI表示1回目）。秘密鍵関連処理なし |
| importNostrKey() | 既存鍵のラッピング | 既存のnsec等をパスキーで保護したい場合 |
| generateNostrKey() | 新規鍵の生成 | 新しいNostrアカウントの作成 |
| directPrfToNostrKey() | PRF直接使用 | PRF値をそのまま秘密鍵とする実装 |

### 5.2 PRF値を直接Nostrシークレットキーとして使用する利点

PRF値を直接Nostrのシークレットキーとして使用することの主な利点：

- **実装の簡素化**: 別途秘密鍵を生成・暗号化する処理が不要
- **セキュリティモデルの明確化**: PRF値だけがシークレットとなり、鍵導出の中間層がなくなる
- **パフォーマンスの向上**: 暗号化・復号の処理が省略され、処理速度が向上
- **ユーザーエクスペリエンスの改善**: 操作回数の削減（パスキー認証だけで完結）

なお、PRF値がsecp256k1の有効な秘密鍵範囲に入らない確率は、実用上無視できるレベルの低さです（約2^-224）。

## 6. 実装のバリエーション

### 暗号化方式
- パスキーから取得したPRF値を使ってNostr秘密鍵を暗号化
- 複数の秘密鍵を同じパスキーで保護可能
- 既存のnsecキーを安全に保管可能

### PRF直接使用方式
- パスキーから取得したPRF値を直接Nostrシークレットキーとして使用
- より単純で効率的だが、既存のnsecは使用できない
