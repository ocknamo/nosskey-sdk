# Nosskey SDK インターフェース仕様（日本語）

## 概要

Nosskey SDKは、WebAuthnパスキーのPRF拡張を使用してNostr秘密鍵を直接導出する方式を採用しています。PWKBlob概念を廃止し、よりシンプルで安全なNostrKeyInfo構造を使用します。

## 主要な型定義

### NostrKeyInfo

```typescript
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
```

### NostrEvent

```typescript
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
```

## メインクラス: NosskeyManager

### コンストラクタ

```typescript
constructor(options?: {
  cacheOptions?: Partial<KeyCacheOptions>;
  storageOptions?: Partial<NostrKeyStorageOptions>;
})
```

### NIP-07互換メソッド

#### getPublicKey()
現在設定されているNostrKeyInfoから公開鍵を取得します。

```typescript
async getPublicKey(): Promise<string>
```

#### signEvent()
現在設定されているNostrKeyInfoでイベントに署名します。

```typescript
async signEvent(event: NostrEvent): Promise<NostrEvent>
```

### NostrKeyInfo管理メソッド

#### setCurrentKeyInfo()
現在のNostrKeyInfoを設定します。ストレージが有効な場合は保存も行います。

```typescript
setCurrentKeyInfo(keyInfo: NostrKeyInfo): void
```

#### getCurrentKeyInfo()
現在のNostrKeyInfoを取得します。未設定の場合はストレージからの読み込みを試みます。

```typescript
getCurrentKeyInfo(): NostrKeyInfo | null
```

#### hasKeyInfo()
NostrKeyInfoが存在するかどうかを確認します。

```typescript
hasKeyInfo(): boolean
```

#### clearStoredKeyInfo()
ストレージに保存されたNostrKeyInfoをクリアします。

```typescript
clearStoredKeyInfo(): void
```

### パスキー関連メソッド

#### isPrfSupported()
PRF拡張機能がサポートされているかチェックします。

```typescript
async isPrfSupported(): Promise<boolean>
```

#### createPasskey()
パスキーを作成します（PRF拡張もリクエスト）。

```typescript
async createPasskey(options?: PasskeyCreationOptions): Promise<Uint8Array>
```

#### createNostrKey()
PRF値を直接Nostrシークレットキーとして使用してNostrKeyInfoを作成します。

```typescript
async createNostrKey(
  credentialId?: Uint8Array,
  options?: KeyOptions
): Promise<NostrKeyInfo>
```

### 署名メソッド

#### signEventWithKeyInfo()
指定されたNostrKeyInfoでイベントに署名します。

```typescript
async signEventWithKeyInfo(
  event: NostrEvent,
  keyInfo: NostrKeyInfo,
  options?: SignOptions
): Promise<NostrEvent>
```

### エクスポートメソッド

#### exportNostrKey()
秘密鍵をエクスポートします。

```typescript
async exportNostrKey(
  keyInfo: NostrKeyInfo,
  credentialId?: Uint8Array
): Promise<string>
```

### キャッシュ管理メソッド

#### setCacheOptions()
キャッシュ設定を更新します。

```typescript
setCacheOptions(options: Partial<KeyCacheOptions>): void
```

#### getCacheOptions()
現在のキャッシュ設定を取得します。

```typescript
getCacheOptions(): KeyCacheOptions
```

#### clearCachedKey()
特定の鍵のキャッシュをクリアします。

```typescript
clearCachedKey(credentialId: Uint8Array | string): void
```

#### clearAllCachedKeys()
全てのキャッシュをクリアします。

```typescript
clearAllCachedKeys(): void
```

### ストレージ管理メソッド

#### setStorageOptions()
NostrKeyInfoストレージの設定を更新します。

```typescript
setStorageOptions(options: Partial<NostrKeyStorageOptions>): void
```

#### getStorageOptions()
現在のNostrKeyInfoストレージ設定を取得します。

```typescript
getStorageOptions(): NostrKeyStorageOptions
```

## オプション型定義

### KeyCacheOptions

```typescript
export interface KeyCacheOptions {
  enabled: boolean; // キャッシュを有効にするかどうか
  timeoutMs?: number; // キャッシュの有効期限（ミリ秒）
}
```

### NostrKeyStorageOptions

```typescript
export interface NostrKeyStorageOptions {
  enabled: boolean; // NostrKeyInfoの保存を有効にするか（デフォルト: true）
  storage?: Storage; // 使用するストレージ（デフォルト: localStorage）
  storageKey?: string; // 保存に使用するキー名（デフォルト: "nosskey_keyinfo"）
}
```

### KeyOptions

```typescript
export interface KeyOptions {
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
  username?: string; // パスキー作成時のユーザー名
}
```

### SignOptions

```typescript
export interface SignOptions {
  clearMemory?: boolean; // 操作後にメモリから秘密鍵を消去するか（デフォルト: true）
  tags?: string[][]; // 追加のタグ
}
```

## 使用例

### 基本的な使用方法

```typescript
import { NosskeyManager } from 'nosskey-sdk';

// インスタンス作成
const nosskey = new NosskeyManager();

// PRF拡張サポートチェック
const isSupported = await nosskey.isPrfSupported();
if (!isSupported) {
  throw new Error('PRF extension not supported');
}

// パスキー作成
const credentialId = await nosskey.createPasskey();

// NostrKeyInfo作成
const keyInfo = await nosskey.createNostrKey(credentialId, {
  username: 'alice'
});

// 現在のキー情報として設定
nosskey.setCurrentKeyInfo(keyInfo);

// イベント署名
const event = {
  kind: 1,
  content: 'Hello, Nostr!',
  tags: []
};

const signedEvent = await nosskey.signEvent(event);
console.log('Signed event:', signedEvent);
```

### キャッシュを有効にした使用方法

```typescript
const nosskey = new NosskeyManager({
  cacheOptions: {
    enabled: true,
    timeoutMs: 10 * 60 * 1000 // 10分
  }
});

// 最初の署名（パスキー認証が必要）
const signedEvent1 = await nosskey.signEvent(event1);

// 2回目の署名（キャッシュから取得、認証不要）
const signedEvent2 = await nosskey.signEvent(event2);
```

## セキュリティ上の利点

1. **秘密鍵の永続保存が不要**: 秘密鍵は署名時のみ一時的に生成され、使用後は即座にメモリから消去される
2. **リレーへの依存なし**: 暗号化された秘密鍵をリレーに保存する必要がない
3. **復元の容易さ**: 同じパスキーがあれば、どのデバイスからでも同じNostr鍵を復元可能
4. **漏洩リスクの軽減**: 永続的な秘密鍵データが存在しないため、データ漏洩のリスクが大幅に軽減
5. **標準化されたsalt値**: 実装間で統一されたsalt値により、互換性が確保される

## 注意事項

| 項目 | 説明 |
|------|------|
| PRF拡張サポート | すべての認証器がPRF拡張をサポートしているわけではありません。使用前に`isPrfSupported()`でチェックしてください。 |
| メモリクリア | Web Cryptoバッファはガベージコレクションによってデタッチされますが、Uint8Arrayの明示的なfill(0)は慎重に行う必要があります。 |
| PRF値の有効性 | PRF値を直接秘密鍵として使用する場合、secp256k1の有効範囲外になる可能性が（極めて低いですが）あります。 |
| デバイス間同期 | パスキーのクラウド同期機能により、複数デバイス間で自動的にアカウントが利用可能になります。 |
