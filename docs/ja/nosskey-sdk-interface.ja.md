# Nosskey SDK インターフェース仕様（日本語）

## 概要

Nosskey SDKは、WebAuthnパスキーのPRF拡張を使用してNostr秘密鍵を直接導出する方式を採用しています。PWKBlob概念を廃止し、よりシンプルで安全なNostrKeyInfo構造を使用します。

## 主要な型定義

### NostrKeyInfo

```typescript
/**
 * Nostr key information
 * 2 つのモードを `wrapped` フィールドの有無で判別する。
 *  - wrapped === undefined: PRF 直接モード（PRF 出力をそのまま Nostr 秘密鍵として使用）
 *  - wrapped が設定済み: wrap モード（PRF 由来 KEK で nsec を NIP-44 v2 暗号化して保存）
 */
export interface NostrKeyInfo {
  credentialId: string; // クレデンシャルIDをhex形式で保存
  pubkey: string; // 公開鍵（hex形式）。wrap モードでも「インポートされた鍵」の公開鍵（KEK・GではなくユーザのNostr公開鍵）
  salt: string; // PRF評価入力として使うsalt（hex形式）。PRF直接モード: "6e6f7374722d70776b" / wrapモード: "6e6f7374722d70776b2d77726170"
  username?: string; // パスキー作成時のユーザー名（取得可能な場合のみ）
  /**
   * wrap モードのメタデータ。
   * 設定されている場合は wrap モード（PRF 由来 KEK で nsec を NIP-44 v2 暗号化して保存）。
   */
  wrapped?: {
    v: 1; // データ形式バージョン
    alg: 'nip44-v2'; // 暗号方式識別子
    payload: string; // nip44Encrypt 戻り値（base64 エンコードされた NIP-44 v2 ペイロード）
  };
}
```

`signEvent` / `nip44Encrypt` / `nip44Decrypt` / `nip04Encrypt` / `nip04Decrypt` / `exportNostrKey` は内部で `wrapped` の有無を判定して透過的に動作するため、呼び出し側は両モードを区別せずに使えます。

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
  prfOptions?: GetPrfSecretOptions;
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

### NIP-44 / NIP-04 暗号化メソッド

現在設定されているNostrKeyInfoの秘密鍵と相手の公開鍵から共有鍵を導出し、ダイレクトメッセージを暗号化・復号します。

#### nip44Encrypt()
NIP-44 v2 で平文を暗号化します。

```typescript
async nip44Encrypt(peerPubkey: string, plaintext: string): Promise<string>
```

#### nip44Decrypt()
NIP-44 v2 のペイロードを復号します。

```typescript
async nip44Decrypt(peerPubkey: string, ciphertext: string): Promise<string>
```

#### nip04Encrypt()
NIP-04（レガシー方式）で平文を暗号化します。

```typescript
async nip04Encrypt(peerPubkey: string, plaintext: string): Promise<string>
```

#### nip04Decrypt()
NIP-04 のペイロードを復号します。

```typescript
async nip04Decrypt(peerPubkey: string, ciphertext: string): Promise<string>
```

### NostrKeyInfo管理メソッド

#### setCurrentKeyInfo()
現在のNostrKeyInfoを設定します。ストレージが有効な場合は current スロットへ保存し、
登録簿が有効な場合は `pubkey + credentialId` をキーにエントリを upsert します。これにより
2 つ目のアカウントを設定しても 1 つ目の `wrapped.payload` が失われません。

```typescript
setCurrentKeyInfo(keyInfo: NostrKeyInfo): void
```

> ⚠️ **wrap モードは非対称**です。wrap 鍵の `wrapped.payload` はインポートした nsec の
> 唯一のコピーで、PRF 直接モードと違いパスキーから再導出できません。登録簿が上書きから
> 守りますが、登録簿を無効にすると上書きで失われます。元 nsec のバックアップ保持を推奨します。

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
保存された鍵情報を**完全に消去**します（current スロット＋登録簿＋メモリ＋派生キャッシュ）。
秘密情報（wrap モードの暗号化 nsec を含む）をすべて削除する破壊的操作です。共有端末からの
完全サインアウト等に使います。ログアウト（再ログインを残したい）には `clearCurrentKeyInfo()`
を使ってください。

```typescript
clearStoredKeyInfo(): void
```

> ⚠️ wrap モードの鍵はこの呼び出し後**復元不能**になります。必要なら事前に元 nsec を
> バックアップしてください。

#### clearCurrentKeyInfo()
ログアウト用。current ポインタ（単一スロット）とメモリ・派生キャッシュのみ消去します。
登録簿は保持されるため、保存済みアカウント（特に復元不能な wrap モード鍵）から再ログイン
できます。

```typescript
clearCurrentKeyInfo(): void
```

#### listKeyInfos()
登録簿に保存されている全 NostrKeyInfo の一覧をディープコピーで返します。登録簿が無効な
場合は空配列を返します。

```typescript
listKeyInfos(): NostrKeyInfo[]
```

#### removeKeyInfo()
登録簿から指定アカウント（`pubkey + credentialId` 一致）を削除します。wrap モードの
エントリを削除するとその暗号化 nsec は復元不能になります。

```typescript
removeKeyInfo(pubkey: string, credentialId: string): void
```

#### backupKeyInfo()
バックアップ用に NostrKeyInfo を**ディープコピーして返します**（`wrapped.payload` を含む）。
引数省略時は current 鍵を、`pubkey`（必要なら `credentialId` も）指定時は登録簿の該当エントリを
返します。該当が無ければ `null`。返り値を改変しても内部状態には影響しません。

```typescript
backupKeyInfo(pubkey?: string, credentialId?: string): NostrKeyInfo | null
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
PRF値を直接Nostrシークレットキーとして使用してNostrKeyInfoを作成します（PRF 直接モード）。

```typescript
async createNostrKey(
  credentialId?: Uint8Array,
  options?: KeyOptions
): Promise<NostrKeyInfo>
```

#### importNostrKey()
既存の Nostr 秘密鍵（nsec の 32 バイト生バイト）を PRF 由来 KEK で NIP-44 v2 暗号化して `NostrKeyInfo` を作成します（wrap モード）。NIP-44 v2 自己宛 DM パターン（`ourSk = KEK` / `peerPk = KEK·G`）で暗号化された payload が `NostrKeyInfo.wrapped.payload` に格納されます。

```typescript
async importNostrKey(
  seckey: Uint8Array,
  credentialId?: Uint8Array,
  options?: KeyOptions
): Promise<NostrKeyInfo>
```

検証ルール:
- `seckey` は 32 バイトの `Uint8Array` でなければなりません（それ以外は例外）。
- 全バイト 0 の `seckey` は拒否されます（不正鍵）。
- PRF 出力（KEK）が全 0 の場合も拒否されます（極めて稀）。

セキュリティメモ:
- 入力された `seckey` バッファ（`Uint8Array`）は関数完了時に SDK 内部で `.fill(0)` されます。呼び出し側でも前後でゼロ化することを推奨します。
- 戻り値の `NostrKeyInfo` を `setCurrentKeyInfo()` でセットすれば、以降の `signEvent` / `nip44Encrypt` / `nip44Decrypt` / `nip04Encrypt` / `nip04Decrypt` / `exportNostrKey` が wrap モードで透過的に動作します（API は PRF 直接モードと完全に同一）。
- **wrap 鍵は復元不能・PRF 直接モードとの非対称性**: 戻り値の `wrapped.payload` はインポートした nsec の唯一のコピーであり、パスキーから再導出できません。登録簿が有効（既定）なら `setCurrentKeyInfo()` は current 上書きを跨いで保持し、`clearCurrentKeyInfo()` によるログアウトでも残ります。ただし `clearStoredKeyInfo()`（完全ワイプ）・`removeKeyInfo()`・`registryEnabled=false` では**永久に失われます**。元 nsec のバックアップ保持を推奨し、`NostrKeyInfo`（`wrapped.payload` 含む）のエクスポートには `backupKeyInfo()` を使ってください。
- **メモリゼロ化の制約**: SDK 内部で秘密鍵を `seckeySigner` 渡しや NIP-44 平文経路に通すため、一時的に hex 文字列（`string`）化されます。JS の `string` は immutable で書き戻し API が無いため、`Uint8Array.fill(0)` 相当のゼロ化は不可能で、**GC タイミングまでヒープに残存します**。`importNostrKey` / `exportNostrKey` / 復号後の `signEvent` などで発生します。ブラウザヒープに直接アクセスできる攻撃者を想定する場合は、この制約を理解した上で利用してください。

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

#### clearPendingPrf()
`createPasskey()` で退避した未消費の PRF キャッシュ（直接モードの実秘密鍵 / wrap モードの KEK）をゼロ化して破棄します。

```typescript
clearPendingPrf(credentialId?: Uint8Array | string): void
```

- `createPasskey()` は標準 salt と wrap salt の PRF を 1 回の UV で同時取得し、直後の `createNostrKey()` / `importNostrKey()` が消費するまで内部キャッシュに保持します。
- 未消費エントリは TTL（`PENDING_PRF_TTL_MS` = 60 秒）経過で自動ゼロ化されますが、`createPasskey()` 後にフローをキャンセル・エラー離脱するなど消費しないことが確定した時点で、本メソッドで即時クリアできます。
- `credentialId` 省略時は全エントリを破棄します。`clearCurrentKeyInfo()`（ログアウト）と `clearStoredKeyInfo()`（完全ワイプ）からも自動的に呼ばれます。
- 破棄後に鍵導出が必要になった場合は、通常どおり `getPrfSecret()` 経由で UV（パスキー認証）が要求されます。

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
  storageKey?: string; // current スロットのキー名（デフォルト: "nosskey_keyinfo"）
  registryEnabled?: boolean; // マルチアカウント登録簿を有効にするか（デフォルト: true）
  registryStorageKey?: string; // 登録簿のキー名（デフォルト: "nosskey_accounts"）
}
```

`registryEnabled` が true（既定）の場合、`setCurrentKeyInfo()` は `registryStorageKey`
（`storageKey` とは別キー）の登録簿へエントリを upsert します。これにより wrap モード鍵が
上書きやログアウトで失われるのを防ぎます。`false` にすると登録簿を一切使わない旧来の単一
スロット挙動になります。

### GetPrfSecretOptions

```typescript
export interface GetPrfSecretOptions {
  rpId?: string; // Relying Party ID
  timeout?: number; // タイムアウト時間（ミリ秒）
  userVerification?: UserVerificationRequirement; // ユーザー検証要件
}
```

### KeyOptions

```typescript
export interface KeyOptions {
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

## パッケージエクスポート

`nosskey-sdk` のエントリポイント（barrel）は、`NosskeyManager` クラスと型定義に加えて以下のスタンドアロン関数を公開しています。

### 低レベル NIP-44 関数

`NosskeyManager.nip44Encrypt()` メソッドが内部で秘密鍵を管理するのに対し、これらのスタンドアロン関数は秘密鍵（`Uint8Array`）を引数として直接受け取ります。**メソッドと同名でもシグネチャが異なる**点に注意してください。登録済みパスキー鍵ではなく ephemeral 秘密鍵で暗号化したいケース（NIP-17 gift-wrap など）で使用します。

```typescript
function nip44Encrypt(
  plaintext: string,
  ourSecretKey: Uint8Array,
  peerPubkeyHex: string,
  nonceOverride?: Uint8Array
): string

function nip44Decrypt(payload: string, ourSecretKey: Uint8Array, peerPubkeyHex: string): string
```

NIP-04 の低レベル関数はエクスポートしていません。NIP-04 の暗号化/復号は `NosskeyManager` の `nip04Encrypt()` / `nip04Decrypt()` メソッドを使用してください。

### PRF ハンドラー関数

`NosskeyManager` の `isPrfSupported()` / `createPasskey()` メソッドは内部でこれらを利用します。直接利用も可能です。

```typescript
function isPrfSupported(): Promise<boolean>

function createPasskey(options?: PasskeyCreationOptions): Promise<Uint8Array>

function getPrfSecret(
  credentialId?: Uint8Array,
  options?: GetPrfSecretOptions,
  salt?: Uint8Array // PRF評価入力。省略時は標準値 "nostr-pwk"
): Promise<{ secret: Uint8Array; id: Uint8Array }>
```

### バイト変換ユーティリティ

```typescript
function bytesToHex(bytes: Uint8Array): string

function hexToBytes(hex: string): Uint8Array
```

### テスト用ユーティリティ

```typescript
function registerDummyPasskey(userId: string): Promise<PublicKeyCredential>
```

テスト・デモ用途のダミーパスキー登録ヘルパーです。本番コードでの使用は想定していません。

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
