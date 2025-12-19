/**
 * PRF (Pseudo-Random Function) handler for WebAuthn
 * @packageDocumentation
 */

import type { GetPrfSecretOptions, PasskeyCreationOptions } from './types.js';

/* 定数 */
const PRF_EVAL_INPUT = new TextEncoder().encode('nostr-pwk');

/**
 * PRF拡張機能がサポートされているかチェック
 * @returns PRF拡張がサポートされているかどうか
 */
export async function isPrfSupported(): Promise<boolean> {
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
export async function createPasskey(options: PasskeyCreationOptions = {}): Promise<Uint8Array> {
  // ブラウザ環境とNodeテスト環境の両方に対応
  const rpName = options.rp?.name || (typeof location !== 'undefined' ? location.host : 'Nosskey');
  const rpId = options.rp?.id;
  const userName = options.user?.name || 'user@example.com';
  const userDisplayName = options.user?.displayName || 'Nosskey user';

  // パスキーを作成
  const credentialCreationOptions: CredentialCreationOptions = {
    publicKey: {
      rp: {
        name: rpName,
        id: rpId,
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

  console.log('DEBGU credentialCreationOptions:', credentialCreationOptions);

  const cred = (await navigator.credentials.create(
    credentialCreationOptions
  )) as PublicKeyCredential;

  return new Uint8Array(cred.rawId);
}

/**
 * クレデンシャルIDを使用してPRF秘密を取得
 * @param credentialId 特定のクレデンシャルIDを指定する場合。省略すると、ユーザーが選択したパスキーが使用される
 * @param options PRF取得オプション（rpId、timeout、userVerification）
 * @returns PRF秘密と使用されたcredentialIDを含むオブジェクト
 */
export async function getPrfSecret(
  credentialId?: Uint8Array,
  options?: GetPrfSecretOptions
): Promise<{ secret: Uint8Array; id: Uint8Array }> {
  const allowCredentials = credentialId ? [{ type: 'public-key' as const, id: credentialId }] : [];

  const requestOptions: PublicKeyCredentialRequestOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials,
    userVerification: options?.userVerification || 'required',
    extensions: {
      prf: { eval: { first: PRF_EVAL_INPUT } },
    } as AuthenticationExtensionsClientInputs,
  };

  // オプショナルパラメータを追加
  if (options?.rpId) {
    requestOptions.rpId = options.rpId;
  }
  if (options?.timeout) {
    requestOptions.timeout = options.timeout;
  }

  console.log('DEBUG requestOptions', requestOptions);

  const response = await navigator.credentials.get({
    publicKey: requestOptions,
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

  // responseからcredentialIdを取得
  const responseId = new Uint8Array((response as PublicKeyCredential).rawId);

  return {
    secret: new Uint8Array(secret),
    id: responseId,
  };
}
