# Passkey-Wrapped Key (PWK) NIP - TypeScript SDK 実装

## 概要

このドキュメントでは、Passkey-Wrapped Key (PWK) NIPのTypeScript SDK実装に関するインターフェース設計と重要なメソッドの実装例を紹介します。

**注意**: このSDKは本番環境向けに完成されたものではなく、エッジケース処理、UXプロンプト、失効処理、および完全な暗号強化は省略されています。主に以下を示しています：

- 公開インターフェース（型とクラス）
- 主要メソッド：`create()`, `signEvent()`, `isPrfSupported()`の実装
- 使用例

## 1. 公開インターフェースと型定義

```typescript
/** Nostr event JSON (simplified) */
export interface NostrEvent {
  id:        string;    // sha256 hash of serialized event
  pubkey:    string;    // hex
  created_at:number;
  kind:      number;
  tags:      string[][];
  content:   string;
  sig?:      string;    // hex
}

/** PWK blob (NIP-XX §3) */
export interface PWKBlobV1 {
  v:    1;
  alg:  'aes-gcm-256';
  salt: string;   // hex(16 B)
  iv:   string;   // hex(12 B)
  ct:   string;   // hex(32 B)
  tag:  string;   // hex(16 B)
}
export type PWKBlob = PWKBlobV1;

/** High-level API */
export interface PWKManagerLike {
  /** Creates a passkey (if none) and returns a new PWK blob */
  create(): Promise<PWKBlob>;

  /** Signs *event* using the PWK.  Rejects if PRF is unavailable. */
  signEvent(event: NostrEvent, pwk: PWKBlob): Promise<string>;

  /** Fast feature test (browser + authenticator) */
  isPrfSupported(): Promise<boolean>;
}
```

## 2. 実装クラス

```typescript
import {bytesToHex, hexToBytes} from '@noble/hashes/utils';
import {hkdf}                 from '@noble/hashes/hkdf';
import {sha256}               from '@noble/hashes/sha256';
import {ed25519}              from '@noble/curves/ed25519';

/* constants */
const PRF_EVAL_INPUT = new TextEncoder().encode('nostr-pwk');
const INFO_BYTES     = new TextEncoder().encode('nostr-pwk');
const AES_LENGTH     = 256; // bits

export class PWKManager implements PWKManagerLike {
  /* ---------- public ------------------------------------------------ */

  async isPrfSupported(): Promise<boolean> {
    // cheap feature test: ask for PRF w/ dummy challenge
    const credIds = await this.#discoverableIds();
    if (!credIds.length) return false;

    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: credIds,
          userVerification: 'required',
          extensions: {prf: {eval: {first: PRF_EVAL_INPUT}}}
        }
      } as any);

      const res = (assertion as any)
        .getClientExtensionResults()
        ?.prf?.results?.first;
      return !!res;
    } catch {
      return false;
    }
  }

  async create(): Promise<PWKBlob> {
    /* 1️⃣  generate / pick an existing passkey */
    const cred = await navigator.credentials.create({
      publicKey: {
        rp:   {name: 'Nostr PWK'},
        user: {id: crypto.getRandomValues(new Uint8Array(16)),
               name: 'user@example.com',
               displayName: 'PWK user'},
        pubKeyCredParams: [{type: 'public-key', alg: -7}], // ES256 placeholder
        authenticatorSelection: {residentKey: 'required'},
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        extensions: {prf: {}}                              // advertise PRF
      }
    } as any) as PublicKeyCredential;

    const credId = new Uint8Array((cred.rawId as ArrayBuffer));
    // persist credId for later
    await this.#storeCredentialId(credId);

    // 2️⃣  obtain PRF secret
    const secret = await this.#prfSecret(credId);

    // 3️⃣  wrap the existing nostr secret key (generate for demo)
    const nostrSK = crypto.getRandomValues(new Uint8Array(32));

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const aes  = await this.#deriveAesGcmKey(secret, salt);

    const {ciphertext, tag} = await this.#aesGcmEncrypt(
      aes, iv, nostrSK);

    // clear plain key
    nostrSK.fill(0);

    return {
      v: 1, alg: 'aes-gcm-256',
      salt: bytesToHex(salt),
      iv:   bytesToHex(iv),
      ct:   bytesToHex(ciphertext),
      tag:  bytesToHex(tag)
    };
  }

  async signEvent(evt: NostrEvent, pwk: PWKBlob): Promise<string> {
    const credId = (await this.#discoverableIds())[0];
    if (!credId) throw new Error('PWK credential not found');

    // 1️⃣  PRF secret
    const secret = await this.#prfSecret(credId);

    // 2️⃣  unwrap key
    const salt = hexToBytes(pwk.salt);
    const iv   = hexToBytes(pwk.iv);
    const ct   = hexToBytes(pwk.ct);
    const tag  = hexToBytes(pwk.tag);

    const aes  = await this.#deriveAesGcmKey(secret, salt);
    const sk   = await this.#aesGcmDecrypt(aes, iv, ct, tag);

    // 3️⃣  sign (Ed25519 example)
    const sig  = ed25519.sign(hexToBytes(evt.id), sk);
    sk.fill(0); // zeroise

    return bytesToHex(sig);
  }

  /* ---------- private helpers -------------------------------------- */

  async #prfSecret(credId: Uint8Array): Promise<Uint8Array> {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{type: 'public-key', id: credId}],
        userVerification: 'required',
        extensions: {prf: {eval: {first: PRF_EVAL_INPUT}}}
      }
    } as any) as PublicKeyCredential;

    const secret = (assertion as any)
      .getClientExtensionResults()
      .prf
      .results
      .first as ArrayBuffer;

    return new Uint8Array(secret);
  }

  async #deriveAesGcmKey(secret: Uint8Array,
                         salt:   Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', secret, 'HKDF', false, ['deriveKey']);

    return crypto.subtle.deriveKey(
      {name: 'HKDF', hash: 'SHA-256', salt, info: INFO_BYTES},
      keyMaterial,
      {name: 'AES-GCM', length: AES_LENGTH},
      false,
      ['encrypt', 'decrypt']
    );
  }

  async #aesGcmEncrypt(key: CryptoKey, iv: Uint8Array, plaintext: Uint8Array) {
    const buf = await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv},
      key,
      plaintext
    );
    // split auth-tag (last 16 B) & ciphertext
    const bytes = new Uint8Array(buf);
    return {
      ciphertext: bytes.slice(0, -16),
      tag:        bytes.slice(-16)
    };
  }

  async #aesGcmDecrypt(key: CryptoKey,
                       iv: Uint8Array,
                       ct: Uint8Array,
                       tag: Uint8Array): Promise<Uint8Array> {
    const buf = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv},
      key,
      new Uint8Array([...ct, ...tag])
    );
    return new Uint8Array(buf);
  }

  /* storage helpers (tiny demo) */
  async #storeCredentialId(id: Uint8Array) {
    localStorage.setItem('pwkCredId', bytesToHex(id));
  }
  async #discoverableIds(): Promise<Uint8Array[]> {
    const hex = localStorage.getItem('pwkCredId');
    return hex ? [hexToBytes(hex)] : [];
  }
}
```

## 3. 使用例

```typescript
const pwkMgr = new PWKManager();

if (await pwkMgr.isPrfSupported()) {
  // First-time setup
  const blob = await pwkMgr.create();
  localStorage.setItem('pwkBlob', JSON.stringify(blob));

  // Later: sign a Nostr event
  const rawEvt: NostrEvent = /* …construct, compute evt.id… */;
  const saved = JSON.parse(localStorage.getItem('pwkBlob')!) as PWKBlob;
  rawEvt.sig  = await pwkMgr.signEvent(rawEvt, saved);
} else {
  // fall back (NIP-46, plaintext, etc.)
}
```

## 4. 注意点と落とし穴

| 項目 | 説明 |
|------|------|
| Credential IDs | 本番環境では、すべてのresident credential IDを保存する必要があります。ユーザーは複数のパスキーを登録する可能性があります。 |
| 曲線の選択 | Nostrは現在secp256k1 Schnorrを使用しています。必要に応じて@noble/secp256k1に切り替えてください。 |
| メモリ消去 | Web Cryptoバッファはガベージコレクションで切り離されますが、Uint8Arraysに対するexplicit fill(0)はまだ慎重に行うべきです。 |
| Windows | Windows Hello（2025-04）はPRFを公開していません。ハードウェアキーを挿入するUIを表示してください。 |
| バックアップ | 暗号化されたPWKブロブをデバイス外（kind 10060）に保存し、追加のパスキーで復元できるようにします。 |

このスケルトンは、nobleライブラリを追加すれば、どのようなバンドラーベースのウェブスタック（Vite、Webpackなど）でもコンパイルできます：

```bash
npm i @noble/hashes @noble/curves
```

ここから以下の拡張が可能です：

- お好みのリアクティブフレームワークでラップ
- ストレージレイヤーを拡張（IndexedDB、クラウドバックアップ）
- 強化：CSP、厳格な型、エラーマッピング、同時実行ガード

## 5. TypeScript SDK 実装例のポイント解説

### 5.1 公開インターフェース設計

| 名前 | 役割 |
|------|------|
| NostrEvent | Nostrのイベント JSONを表す型（id/pubkey/kind/tags/contentなどを保持）。 |
| PWKBlob | パスキーPRFで包んだ秘密鍵を格納する構造体（NIP-XX §3のフォーマットそのまま）。 |
| PWKManagerLike | SDKが提供する3つのメソッドを定義するインターフェース。<br>- create() … 初回登録。パスキーを生成しPRFからAES-GCM鍵を導出して秘密鍵をラップ、PWKBlobを返す。<br>- signEvent(evt, blob) … PRFでアンラップ→イベント署名→署名文字列を返す。<br>- isPrfSupported() … ブラウザ + オーセンティケータのPRF対応を高速チェック。 |

### 5.2 実装クラス PWKManager

```typescript
export class PWKManager implements PWKManagerLike {
  // ① PRF 対応チェック
  async isPrfSupported(): Promise<boolean> { ... }

  // ② PWK 作成フロー
  async create(): Promise<PWKBlob> {
    // 1) passkey を作る (residentKey 必須)
    // 2) PRF シークレット取得 (#prfSecret)
    // 3) HKDF → AES-GCM 鍵導出 (#deriveAesGcmKey)
    // 4) 既存 `nsec` を暗号化 (#aesGcmEncrypt) → PWKBlob を生成
  }

  // ③ 署名フロー
  async signEvent(evt: NostrEvent, blob: PWKBlob): Promise<string> {
    // 1) PRF シークレットを再取得
    // 2) AES-GCM でアンラップ (#aesGcmDecrypt)
    // 3) noble-ed25519 / secp256k1 で署名
    // 4) 秘密鍵 Uint8Array を fill(0) でゼロ化
  }

  /* ========== 内部ヘルパ ========== */
  #prfSecret(...)           // WebAuthn PRF 拡張呼び出し
  #deriveAesGcmKey(...)     // HKDF-SHA256
  #aesGcmEncrypt / Decrypt  // WebCrypto AES-GCM (タグ 16 B)
  #storeCredentialId(...)   // 今回は localStorage に保存
  #discoverableIds()        // 登録済み passkey ID を取得
}
```

PRF_EVAL_INPUTは "nostr-pwk" という固定文字列。これを extensions.prf.eval.first に渡す事で、同じ passkey から毎回同一 32 B シークレットを取得できます。

暗号化は AES-GCM 256bit、タグは末尾 16 B とし、IV 12 B をランダム生成。

noble-系ライブラリ（@noble/hashes / @noble/curves）を使用し、ブラウザでも RNG・署名が動きます。

### 5.3 使用イメージ

```typescript
const mgr = new PWKManager();

// 初回セットアップ
const blob = await mgr.create();
localStorage.setItem('pwkBlob', JSON.stringify(blob));

// イベント送信時
const saved = JSON.parse(localStorage.getItem('pwkBlob')!);
event.sig   = await mgr.signEvent(event, saved);
relay.publish(event);
```

### 5.4 実装上の注意点

| 項目 | 説明 |
|------|------|
| Credential ID の保存 | 複数デバイス・複数 passkey を考慮して IndexedDB などにリストで保持するのが理想。 |
| 曲線の切替 | Nostr は secp256k1（Schnorr）が主流。必要に応じて @noble/secp256k1 に差し替え。 |
| Windows Hello | 2025-04 時点で PRF 未対応。isPrfSupported() が false なら NIP-46 (リモート署名) などへフォールバック。 |
| メモリ消去 | 復号後の秘密鍵は Uint8Array.fill(0) で即消去し、GC を待たない。 |
| バックアップ | 作成した PWKBlob を kind 10060 で暗号化してリレーに保存すると、別端末でも passkey だけで復元できる。 |

この骨格を出発点に、エラーハンドリング・UX 周り・ストレージ層（IndexedDB / Cloud）を拡充すれば、実運用レベルの SDK になります。
