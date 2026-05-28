/**
 * PRF (Pseudo-Random Function) handler for WebAuthn
 * @packageDocumentation
 */

import type { GetPrfSecretOptions, PasskeyCreationOptions } from './types.js';

/* 定数 */
// 標準のPRF評価入力（salt）。"nostr-pwk" のUTF-8バイト。
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
 * パスキー作成の戻り値。
 * - `id`: 作成された credential の rawId
 * - `prfFirst` / `prfSecond`: create 時に同時に eval された PRF 出力。
 *   ブラウザ/オーセンティケータが PRF を作成時に返さない場合（PRF 非対応、
 *   または `extensions.prf.eval` を要求していないケース）は undefined。
 *   NosskeyManager がここで返った PRF を内部キャッシュして、直後の
 *   `getPrfSecret()` 呼び出し（= 2 回目の UV）を省略するために使う。
 */
export interface CreatePasskeyResult {
  id: Uint8Array;
  prfFirst?: Uint8Array;
  prfSecond?: Uint8Array;
}

/**
 * パスキーを作成（PRF拡張もリクエスト）
 * @param options パスキー作成オプション
 * @param prfSalts 作成時に同時に eval する PRF salt（first/second の2 入力）。
 *                 指定された salt について返る PRF は呼び出し側がキャッシュして
 *                 再利用できる（直後の get() を省略可能にする目的）。
 *                 `options.extensions` が指定されている場合はそちらが優先される。
 * @returns 作成された credential の id と、create 時に取得できた PRF 出力
 */
export async function createPasskey(
  options: PasskeyCreationOptions = {},
  prfSalts?: { first?: Uint8Array; second?: Uint8Array }
): Promise<CreatePasskeyResult> {
  // ブラウザ環境とNodeテスト環境の両方に対応
  const rpName = options.rp?.name || (typeof location !== 'undefined' ? location.host : 'Nosskey');
  const rpId = options.rp?.id;
  const userName = options.user?.name || 'user@example.com';
  const userDisplayName = options.user?.displayName || 'Nosskey user';

  // PRF eval を組み立て（呼び出し側で options.extensions を明示指定していない場合のみ使用）。
  // first を指定すると create 時に PRF が即時 eval され、戻り値で受け取れる。
  // Chrome on Android では create 時に PRF を eval しておかないと、直後の get で
  // results.first === undefined になる「PRF 初期化遅延」既知挙動を踏むため、
  // 既定で first を必ず付ける（呼び出し側が salt を指定しなくても標準値を使う）。
  const firstSalt = prfSalts?.first ?? PRF_EVAL_INPUT;
  const prfEval: { first: Uint8Array; second?: Uint8Array } = { first: firstSalt };
  if (prfSalts?.second) {
    prfEval.second = prfSalts.second;
  }

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
      extensions: options.extensions || { prf: { eval: prfEval } },
    } as PublicKeyCredentialCreationOptions,
  };
  const cred = (await navigator.credentials.create(
    credentialCreationOptions
  )) as PublicKeyCredential;

  // create 時に eval された PRF を取り出す（オーセンティケータが対応していれば）
  const extResults = (
    cred as unknown as {
      getClientExtensionResults?: () => {
        prf?: { results?: { first?: ArrayBuffer; second?: ArrayBuffer } };
      };
    }
  ).getClientExtensionResults?.();
  const prfFirstBuf = extResults?.prf?.results?.first;
  const prfSecondBuf = extResults?.prf?.results?.second;

  return {
    id: new Uint8Array(cred.rawId),
    ...(prfFirstBuf && { prfFirst: new Uint8Array(prfFirstBuf) }),
    ...(prfSecondBuf && { prfSecond: new Uint8Array(prfSecondBuf) }),
  };
}

/**
 * クレデンシャルIDを使用してPRF秘密を取得
 * @param credentialId 特定のクレデンシャルIDを指定する場合。省略すると、ユーザーが選択したパスキーが使用される
 * @param options PRF取得オプション（rpId、timeout、userVerification）
 * @param salt PRF評価入力（salt）。省略すると標準値 "nostr-pwk" が使用される
 * @returns PRF秘密と使用されたcredentialIDを含むオブジェクト
 */
export async function getPrfSecret(
  credentialId?: Uint8Array,
  options?: GetPrfSecretOptions,
  salt?: Uint8Array
): Promise<{ secret: Uint8Array; id: Uint8Array }> {
  const allowCredentials = credentialId ? [{ type: 'public-key' as const, id: credentialId }] : [];

  const requestOptions: PublicKeyCredentialRequestOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials,
    userVerification: options?.userVerification || 'required',
    extensions: {
      prf: { eval: { first: salt ?? PRF_EVAL_INPUT } },
    } as AuthenticationExtensionsClientInputs,
  };

  // オプショナルパラメータを追加
  if (options?.rpId) {
    requestOptions.rpId = options.rpId;
  }
  if (options?.timeout) {
    requestOptions.timeout = options.timeout;
  }

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
