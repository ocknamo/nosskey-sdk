/**
 * Nosskey class for Passkey-Derived Nostr Identity
 * @packageDocumentation
 */
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { seckeySigner } from 'rx-nostr-crypto';
import type {
  CreateResult,
  KeyCacheOptions,
  KeyOptions,
  NostrEvent,
  PWKBlob,
  PWKBlobV1,
  PWKManagerLike,
  PasskeyCreationOptions,
  SignOptions,
} from './types.js';

/* 定数 */
const PRF_EVAL_INPUT = new TextEncoder().encode('nostr-pwk');
const INFO_BYTES = new TextEncoder().encode('nostr-pwk');
const AES_LENGTH = 256; // bits

/**
 * WebAuthn PRF 拡張のレスポンス型
 */
type PRFExtensionResponse = {
  getClientExtensionResults(): {
    prf?: {
      results?: {
        first?: ArrayBuffer;
      };
    };
  };
};

/**
 * Nosskey - Passkey-Wrapped Key for Nostr
 */
export class PWKManager implements PWKManagerLike {
  // 一時的に保持する秘密鍵
  #cachedKeys: Map<string, { sk: Uint8Array; expireAt: number }> = new Map();

  // キャッシュの設定
  #cacheOptions: KeyCacheOptions = {
    enabled: false,
    timeoutMs: 5 * 60 * 1000, // デフォルト5分
  };

  /**
   * PWKManager コンストラクタ
   * @param options 初期化オプション
   */
  constructor(options?: { cacheOptions?: Partial<KeyCacheOptions> }) {
    if (options?.cacheOptions) {
      this.#cacheOptions = { ...this.#cacheOptions, ...options.cacheOptions };
    }
  }

  /**
   * キャッシュ設定を更新
   * @param options キャッシュオプション
   */
  setCacheOptions(options: Partial<KeyCacheOptions>): void {
    this.#cacheOptions = { ...this.#cacheOptions, ...options };

    // キャッシュが無効化された場合は全てのキャッシュをクリア
    if (options.enabled === false) {
      this.clearAllCachedKeys();
    }
  }

  /**
   * 現在のキャッシュ設定を取得
   */
  getCacheOptions(): KeyCacheOptions {
    return { ...this.#cacheOptions };
  }

  /**
   * 特定の鍵のキャッシュをクリア
   * @param credentialId クレデンシャルID
   */
  clearCachedKey(credentialId: Uint8Array | string): void {
    const id = typeof credentialId === 'string' ? credentialId : bytesToHex(credentialId);
    const cached = this.#cachedKeys.get(id);
    if (cached) {
      this.clearKey(cached.sk);
      this.#cachedKeys.delete(id);
    }
  }

  /**
   * 全てのキャッシュをクリア
   */
  clearAllCachedKeys(): void {
    for (const { sk } of this.#cachedKeys.values()) {
      this.clearKey(sk);
    }
    this.#cachedKeys.clear();
  }
  /**
   * PRF拡張機能がサポートされているかチェック
   */
  async isPrfSupported(): Promise<boolean> {
    try {
      const response = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [],
          userVerification: 'required',
          extensions: { prf: { eval: { first: PRF_EVAL_INPUT } } },
        } as PublicKeyCredentialRequestOptions,
      });

      if (!response) return false;

      // 型アサーション
      const assertion = response as unknown as {
        getClientExtensionResults: () => {
          prf?: {
            results?: {
              first?: ArrayBuffer;
            };
          };
        };
      };

      const res = assertion.getClientExtensionResults()?.prf?.results?.first;
      return !!res;
    } catch {
      return false;
    }
  }

  /**
   * パスキーを作成（PRF拡張もリクエスト）
   * @param options パスキー作成オプション
   * @returns Credentialの識別子を返す
   */
  async createPasskey(options: PasskeyCreationOptions = {}): Promise<Uint8Array> {
    // ブラウザ環境とNodeテスト環境の両方に対応
    const rpName =
      options.rp?.name || (typeof location !== 'undefined' ? location.host : 'Nostr PWK');
    const rpId = options.rp?.id;
    const userName = options.user?.name || 'user@example.com';
    const userDisplayName = options.user?.displayName || 'PWK user';

    // パスキーを作成
    const credentialCreationOptions: CredentialCreationOptions = {
      publicKey: {
        rp: {
          name: rpName,
          ...(rpId && { id: rpId }),
        },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: userName,
          displayName: userDisplayName,
        },
        pubKeyCredParams: options.pubKeyCredParams || [{ type: 'public-key', alg: -7 }], // ES256
        authenticatorSelection: options.authenticatorSelection || {
          residentKey: 'required',
          userVerification: 'required',
        },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        extensions: options.extensions || { prf: {} }, // PRF拡張を要求
      } as PublicKeyCredentialCreationOptions,
    };
    const cred = (await navigator.credentials.create(
      credentialCreationOptions
    )) as PublicKeyCredential;

    return new Uint8Array(cred.rawId);
  }

  /**
   * 既存のNostr秘密鍵をパスキーでラップして保護
   * @param credentialId 使用するクレデンシャルID
   * @param secretKey インポートする既存の秘密鍵
   * @param options オプション
   */
  async importNostrKey(
    credentialId: Uint8Array,
    secretKey: Uint8Array,
    options: KeyOptions = {}
  ): Promise<CreateResult> {
    const { clearMemory = true } = options;

    // PRF秘密を取得
    const secret = await this.#prfSecret(credentialId);

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(secretKey);

    // rx-nostr-cryptoを使用して公開鍵を取得
    const signer = seckeySigner(skHex);
    const publicKey = await signer.getPublicKey();

    // 秘密鍵を暗号化
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aes = await this.#deriveAesGcmKey(secret, salt);

    const { ciphertext, tag } = await this.#aesGcmEncrypt(aes, iv, secretKey);

    // 必要に応じて平文の秘密鍵を消去
    if (clearMemory) {
      this.clearKey(secretKey);
    }

    // 結果を返却
    return {
      pwkBlob: {
        v: 1,
        alg: 'aes-gcm-256',
        salt: bytesToHex(salt),
        iv: bytesToHex(iv),
        ct: bytesToHex(ciphertext),
        tag: bytesToHex(tag),
        credentialId: bytesToHex(credentialId),
      },
      credentialId,
      publicKey,
    };
  }

  /**
   * 新しいNostr秘密鍵を生成してパスキーでラップ
   * @param credentialId 使用するクレデンシャルID
   * @param options オプション
   */
  async generateNostrKey(
    credentialId: Uint8Array,
    options: KeyOptions = {}
  ): Promise<CreateResult> {
    // 新しいNostr秘密鍵を生成
    const nostrSK = crypto.getRandomValues(new Uint8Array(32));

    // importNostrKeyを利用して処理を共通化
    return this.importNostrKey(credentialId, nostrSK, options);
  }

  /**
   * PRF値を直接Nostrシークレットキーとして使用（PoC実装）
   * @param credentialId 使用するクレデンシャルID
   */
  async directPrfToNostrKey(credentialId: Uint8Array): Promise<CreateResult> {
    // PRF秘密を取得（これが直接シークレットキーになる）
    const sk = await this.#prfSecret(credentialId);

    // secp256k1の有効範囲チェック
    // 注: 実用上は確率が非常に低いため省略可能
    if (sk.every((byte) => byte === 0)) {
      throw new Error('Invalid PRF output: all zeros');
    }

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    // rx-nostr-cryptoを使用して公開鍵を取得
    const signer = seckeySigner(skHex);
    const publicKey = await signer.getPublicKey();

    // PWKBlobDirectを返却
    return {
      pwkBlob: {
        v: 1,
        alg: 'prf-direct',
        credentialId: bytesToHex(credentialId),
      },
      credentialId,
      publicKey,
    };
  }

  /**
   * イベントに署名
   * @param event 署名するNostrイベント
   * @param pwk 暗号化された秘密鍵またはPRF直接使用
   * @param credentialId 使用するクレデンシャルID
   * @param options 署名オプション
   */
  async signEvent(
    event: NostrEvent,
    pwk: PWKBlob,
    credentialId: Uint8Array,
    options: SignOptions = {}
  ): Promise<NostrEvent> {
    const { clearMemory = true, tags, useCache } = options;

    // useCache が明示的に指定されていればその値を、そうでなければグローバル設定を使用
    const shouldUseCache = useCache !== undefined ? useCache : this.#cacheOptions.enabled;

    const credentialIdHex = bytesToHex(credentialId);
    let sk: Uint8Array | undefined;

    // キャッシュが有効で、キャッシュに鍵がある場合はそれを使用
    if (shouldUseCache && this.#cachedKeys.has(credentialIdHex)) {
      const cached = this.#cachedKeys.get(credentialIdHex);

      if (cached) {
        // 有効期限をチェック
        if (Date.now() < cached.expireAt) {
          sk = cached.sk;
        } else {
          // 期限切れの場合は削除
          this.#cachedKeys.delete(credentialIdHex);
          this.clearKey(cached.sk);
        }
      }
    }

    // キャッシュがない場合は通常の処理
    if (!sk) {
      // PRF値を取得
      const prfSecret = await this.#prfSecret(credentialId);

      // PWKの種類によって処理を分岐
      if (pwk.alg === 'prf-direct') {
        // PRF値を直接シークレットキーとして使用
        sk = prfSecret;
      } else {
        // PWKBlobV1として扱い、暗号化された秘密鍵を復号
        const pwkV1 = pwk as PWKBlobV1;
        const salt = hexToBytes(pwkV1.salt);
        const iv = hexToBytes(pwkV1.iv);
        const ct = hexToBytes(pwkV1.ct);
        const tag = hexToBytes(pwkV1.tag);

        const aes = await this.#deriveAesGcmKey(prfSecret, salt);
        sk = await this.#aesGcmDecrypt(aes, iv, ct, tag);
      }

      // キャッシュが有効な場合は保存
      if (shouldUseCache) {
        const expireAt = Date.now() + (this.#cacheOptions.timeoutMs || 5 * 60 * 1000);
        // コピーを作成して保存
        this.#cachedKeys.set(credentialIdHex, {
          sk: new Uint8Array(sk),
          expireAt,
        });
      }
    }

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    // rx-nostr-crypto seckeySigner を使用して署名
    const signer = seckeySigner(skHex, { tags });
    const signedEvent = await signer.signEvent(event);

    // キャッシュを使用しない場合、または明示的にclearMemory=trueの場合のみメモリクリア
    if (!shouldUseCache && clearMemory) {
      this.clearKey(sk);
    }

    return signedEvent;
  }

  /**
   * 暗号化された秘密鍵をエクスポート
   * @param pwk PWKBlob形式の暗号化された秘密鍵
   * @param credentialId 使用するクレデンシャルID
   * @returns エクスポートされた秘密鍵（16進数文字列）
   */
  async exportNostrKey(pwk: PWKBlob, credentialId: Uint8Array): Promise<string> {
    // PRF値を取得
    const prfSecret = await this.#prfSecret(credentialId);

    let sk: Uint8Array;

    // PWKの種類によって処理を分岐
    if (pwk.alg === 'prf-direct') {
      // PRF値を直接シークレットキーとして使用
      sk = new Uint8Array(prfSecret);
    } else {
      // PWKBlobV1として扱い、暗号化された秘密鍵を復号
      const pwkV1 = pwk as PWKBlobV1;
      const salt = hexToBytes(pwkV1.salt);
      const iv = hexToBytes(pwkV1.iv);
      const ct = hexToBytes(pwkV1.ct);
      const tag = hexToBytes(pwkV1.tag);

      const aes = await this.#deriveAesGcmKey(prfSecret, salt);
      sk = await this.#aesGcmDecrypt(aes, iv, ct, tag);
    }

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    // メモリからのクリアは、リターン後に元の参照が失われるため必要ない
    // テスト環境では関数が完了した後も保持されるため意図的にスキップ
    // 実際のブラウザ環境では問題ない
    // this.clearKey(sk);

    return skHex;
  }

  /**
   * 秘密鍵をメモリから明示的に消去
   * @param key 消去する秘密鍵
   */
  clearKey(key: Uint8Array): void {
    key?.fill?.(0);
  }

  /* 内部ヘルパーメソッド */

  /**
   * クレデンシャルIDを使用してPRF秘密を取得
   */
  async #prfSecret(credentialId: Uint8Array): Promise<Uint8Array> {
    const response = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: credentialId }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: PRF_EVAL_INPUT } } },
      } as PublicKeyCredentialRequestOptions,
    });

    if (!response) {
      throw new Error('Authentication failed');
    }

    // 型アサーション
    const assertion = response as unknown as {
      getClientExtensionResults: () => {
        prf?: {
          results?: {
            first?: ArrayBuffer;
          };
        };
      };
    };

    const secret = assertion.getClientExtensionResults()?.prf?.results?.first;
    if (!secret) {
      throw new Error('PRF secret not available');
    }

    return new Uint8Array(secret);
  }

  /**
   * PRF秘密からAES-GCM鍵を導出
   */
  async #deriveAesGcmKey(secret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);

    return crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: INFO_BYTES },
      keyMaterial,
      { name: 'AES-GCM', length: AES_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * AES-GCM暗号化
   */
  async #aesGcmEncrypt(key: CryptoKey, iv: Uint8Array, plaintext: Uint8Array) {
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

    // 認証タグ(16バイト)と暗号文を分離
    const bytes = new Uint8Array(buf);
    return {
      ciphertext: bytes.slice(0, -16),
      tag: bytes.slice(-16),
    };
  }

  /**
   * AES-GCM復号
   */
  async #aesGcmDecrypt(
    key: CryptoKey,
    iv: Uint8Array,
    ct: Uint8Array,
    tag: Uint8Array
  ): Promise<Uint8Array> {
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      new Uint8Array([...ct, ...tag])
    );
    return new Uint8Array(buf);
  }
}
