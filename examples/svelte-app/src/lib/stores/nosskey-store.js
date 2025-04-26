import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { PWKManager } from 'nosskey-sdk';
import { derived, writable } from 'svelte/store';

// ストア初期化
export const pwkManager = new PWKManager();
export const isSupported = writable(false);
export const credentialId = writable(null);
export const pwkBlob = writable(null);
export const publicKey = writable(null);
export const isAuthenticated = derived(
  [credentialId, pwkBlob, publicKey],
  ([$credentialId, $pwkBlob, $publicKey]) => !!$credentialId && !!$pwkBlob && !!$publicKey
);

// Passkey対応確認
export async function checkSupport() {
  try {
    const supported = await pwkManager.isPrfSupported();
    isSupported.set(supported);
    return supported;
  } catch (error) {
    console.error('PRF対応確認エラー:', error);
    isSupported.set(false);
    return false;
  }
}

// Passkey登録とPRF直接使用
export async function registerDirectPrf() {
  try {
    // パスキー作成
    const createdCredentialId = await pwkManager.createPasskey();

    // PRF値から直接シークレットキーを導出
    const result = await pwkManager.directPrfToNostrKey(createdCredentialId);

    // ストアとlocalStorageに保存
    credentialId.set(createdCredentialId);
    pwkBlob.set(result.pwkBlob);
    publicKey.set(result.publicKey);

    // ローカルストレージに保存
    localStorage.setItem('credentialId', bytesToHex(createdCredentialId));
    localStorage.setItem('pwkBlob', JSON.stringify(result.pwkBlob));
    localStorage.setItem('publicKey', result.publicKey);

    return result;
  } catch (error) {
    console.error('登録エラー:', error);
    throw error;
  }
}

// 保存済みの認証情報を読み込む
export function loadSavedCredentials() {
  try {
    const savedCredentialId = localStorage.getItem('credentialId');
    const savedPwkBlob = localStorage.getItem('pwkBlob');
    const savedPublicKey = localStorage.getItem('publicKey');

    if (savedCredentialId && savedPwkBlob && savedPublicKey) {
      credentialId.set(hexToBytes(savedCredentialId));
      pwkBlob.set(JSON.parse(savedPwkBlob));
      publicKey.set(savedPublicKey);
      return true;
    }
    return false;
  } catch (error) {
    console.error('認証情報読み込みエラー:', error);
    return false;
  }
}

// Nostrイベントの署名
export async function signNostrEvent(event) {
  let $credentialId;
  let $pwkBlob;

  // ストアから最新の値を取得（スナップショット的アクセス）
  credentialId.subscribe((value) => {
    $credentialId = value;
  })();
  pwkBlob.subscribe((value) => {
    $pwkBlob = value;
  })();

  if (!$credentialId || !$pwkBlob) {
    throw new Error('認証情報が不足しています');
  }

  try {
    // イベントに署名
    const signedEvent = await pwkManager.signEvent(event, $pwkBlob, $credentialId);

    return signedEvent;
  } catch (error) {
    console.error('署名エラー:', error);
    throw error;
  }
}

// 切断・ログアウト
export function clearCredentials() {
  localStorage.removeItem('credentialId');
  localStorage.removeItem('pwkBlob');
  localStorage.removeItem('publicKey');

  credentialId.set(null);
  pwkBlob.set(null);
  publicKey.set(null);
}
