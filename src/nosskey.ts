/**
 * Nosskey class for Passkey-Derived Nostr Identity
 * @packageDocumentation
 */
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { seckeySigner } from 'rx-nostr-crypto';
import type {
  CreateResult,
  KeyOptions,
  NostrEvent,
  PWKBlob,
  PWKBlobV1,
  PWKManagerLike,
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
   * @returns Credentialの識別子を返す
   */
  async createPasskey(): Promise<Uint8Array> {
    // パスキーを作成
    const credentialCreationOptions: CredentialCreationOptions = {
      publicKey: {
        rp: { name: 'Nostr PWK' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'user@example.com',
          displayName: 'PWK user',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required',
        },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        extensions: { prf: {} }, // PRF拡張を要求
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
    const { clearMemory = true, tags } = options;

    // PRF値を取得
    const prfSecret = await this.#prfSecret(credentialId);

    let sk: Uint8Array;

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

    // 秘密鍵HEX文字列を取得
    const skHex = bytesToHex(sk);

    // rx-nostr-crypto seckeySigner を使用して署名
    const signer = seckeySigner(skHex, { tags });
    const signedEvent = await signer.signEvent(event);

    // 必要に応じて平文の秘密鍵を消去
    if (clearMemory) {
      this.clearKey(sk);
    }

    return signedEvent;
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
