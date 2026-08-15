import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager } from './nosskey.js';
import { installWebAuthnMocks, mockCredentialId } from './nosskey.test-helpers.js';
import { STANDARD_SALT, WRAP_SALT } from './salt.js';
import type { NostrKeyInfo } from './types.js';
import { bytesToHex } from './utils.js';

vi.mock('@rx-nostr/crypto', () => {
  return {
    seckeySigner: vi.fn(() => ({
      signEvent: vi.fn(async (event) => ({
        ...event,
        id: 'test-event-id',
        sig: 'test-signature',
      })),
      getPublicKey: vi.fn(async () => 'test-pubkey'),
    })),
  };
});

const CRED_ID_HEX = bytesToHex(mockCredentialId);

/** 直接モード（PRF 出力がそのまま秘密鍵）のエントリ。 */
const directEntry: NostrKeyInfo = {
  credentialId: CRED_ID_HEX,
  pubkey: 'test-pubkey',
  salt: STANDARD_SALT,
  username: 'alice',
};

/** wrap モード（インポートした nsec を PRF 由来 KEK で暗号化）のエントリ。 */
const wrapEntry: NostrKeyInfo = {
  credentialId: CRED_ID_HEX,
  pubkey: 'imported-pubkey',
  salt: WRAP_SALT,
  username: 'bob',
  wrapped: { v: 1, alg: 'nip44-v2', payload: 'ZW5jcnlwdGVk' },
};

describe('NosskeyManager ログイン（保存済み鍵の復元）', () => {
  let webauthn: ReturnType<typeof installWebAuthnMocks>;
  let mockLocalStorage: { [key: string]: string };

  beforeEach(() => {
    webauthn = installWebAuthnMocks();
    mockLocalStorage = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        setItem: vi.fn((key, value) => {
          mockLocalStorage[key] = value;
        }),
        getItem: vi.fn((key) => mockLocalStorage[key] ?? null),
        removeItem: vi.fn((key) => {
          delete mockLocalStorage[key];
        }),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    webauthn.restore();
    vi.clearAllMocks();
  });

  /** 登録簿へ直接書き込む（SDK の永続化フォーマットと同じ）。 */
  function seedRegistry(entries: NostrKeyInfo[]): void {
    mockLocalStorage.nosskey_accounts = JSON.stringify(entries);
  }

  describe('loginWithPasskey', () => {
    it('登録簿の直接モード鍵を復元する（新規生成しない）', async () => {
      seedRegistry([directEntry]);
      const nosskey = new NosskeyManager();

      const result = await nosskey.loginWithPasskey();

      expect(result.status).toBe('restored');
      if (result.status !== 'restored') return;
      // username まで含めて保存済みエントリそのものが返る（＝復元であって生成ではない）
      expect(result.keyInfo).toEqual(directEntry);
    });

    it('wrap モード鍵を wrapped 付きのまま復元する（別 pubkey を生成しない）', async () => {
      seedRegistry([wrapEntry]);
      const nosskey = new NosskeyManager();

      const result = await nosskey.loginWithPasskey();

      expect(result.status).toBe('restored');
      if (result.status !== 'restored') return;
      expect(result.keyInfo.pubkey).toBe('imported-pubkey');
      expect(result.keyInfo.salt).toBe(WRAP_SALT);
      expect(result.keyInfo.wrapped?.payload).toBe('ZW5jcnlwdGVk');
    });

    it('回帰: 同じ wrap モード鍵に createNostrKey を使うと別 pubkey・別 salt になる', async () => {
      // 旧ログイン導線（createNostrKey）が「知らない鍵でログイン」を起こしていた経路。
      // loginWithPasskey との差分を固定して再発を検知する。
      seedRegistry([wrapEntry]);
      const nosskey = new NosskeyManager();

      const generated = await nosskey.createNostrKey();

      expect(generated.pubkey).not.toBe(wrapEntry.pubkey);
      expect(generated.salt).toBe(STANDARD_SALT);
      expect(generated.wrapped).toBeUndefined();
    });

    it('該当が無ければ unknown を返し、鍵を生成しない', async () => {
      const nosskey = new NosskeyManager();

      const result = await nosskey.loginWithPasskey();

      expect(result.status).toBe('unknown');
      if (result.status !== 'unknown') return;
      expect(result.credentialId).toBe(CRED_ID_HEX);
      // 登録簿にも current スロットにも何も書かれない
      expect(mockLocalStorage.nosskey_keyinfo).toBeUndefined();
    });

    it('unknown 後の createNostrKey は追加の UV なしで導出できる', async () => {
      const nosskey = new NosskeyManager();

      const result = await nosskey.loginWithPasskey();
      expect(result.status).toBe('unknown');
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);

      const keyInfo = await nosskey.createNostrKey(mockCredentialId);

      expect(keyInfo.credentialId).toBe(CRED_ID_HEX);
      // 退避した PRF を消費するので assertion は増えない
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    });

    it('同一 credentialId に複数エントリがあれば ambiguous を返す', async () => {
      seedRegistry([directEntry, { ...wrapEntry, pubkey: 'imported-pubkey' }]);
      const nosskey = new NosskeyManager();

      const result = await nosskey.loginWithPasskey();

      expect(result.status).toBe('ambiguous');
      if (result.status !== 'ambiguous') return;
      expect(result.credentialId).toBe(CRED_ID_HEX);
      expect(result.candidates).toHaveLength(2);
    });

    it('直接モードで保存 pubkey が PRF 由来 pubkey と一致しなければ throw する', async () => {
      seedRegistry([{ ...directEntry, pubkey: 'tampered-pubkey' }]);
      const nosskey = new NosskeyManager();

      await expect(nosskey.loginWithPasskey()).rejects.toThrow(/does not match this passkey/);
    });

    it('直接モードの復元でキャッシュが温まり、初回署名で UV を再要求しない', async () => {
      seedRegistry([directEntry]);
      const nosskey = new NosskeyManager({ cacheOptions: { enabled: true, timeoutMs: 60_000 } });

      const result = await nosskey.loginWithPasskey();
      expect(result.status).toBe('restored');
      if (result.status !== 'restored') return;
      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);

      await nosskey.signEventWithKeyInfo({ kind: 1, content: 'hello' }, result.keyInfo);

      expect(navigator.credentials.get).toHaveBeenCalledTimes(1);
    });

    it('キャッシュ無効時も復元でき、署名時に改めて UV を要求する', async () => {
      seedRegistry([directEntry]);
      const nosskey = new NosskeyManager();

      const result = await nosskey.loginWithPasskey();
      expect(result.status).toBe('restored');
      if (result.status !== 'restored') return;

      await nosskey.signEventWithKeyInfo({ kind: 1, content: 'hello' }, result.keyInfo);

      expect(navigator.credentials.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('findKeyInfosByCredentialId', () => {
    it('credentialId の大文字小文字を無視して一致させる', () => {
      seedRegistry([directEntry]);
      const nosskey = new NosskeyManager();

      expect(nosskey.findKeyInfosByCredentialId(CRED_ID_HEX.toUpperCase())).toHaveLength(1);
    });

    it('一致しない credentialId では空配列を返す', () => {
      seedRegistry([directEntry]);
      const nosskey = new NosskeyManager();

      expect(nosskey.findKeyInfosByCredentialId('00'.repeat(16))).toEqual([]);
    });

    it('登録簿が無効でも current スロットの鍵は引ける', () => {
      mockLocalStorage.nosskey_keyinfo = JSON.stringify(directEntry);
      const nosskey = new NosskeyManager({ storageOptions: { registryEnabled: false } });

      const found = nosskey.findKeyInfosByCredentialId(CRED_ID_HEX);

      expect(found).toHaveLength(1);
      expect(found[0].pubkey).toBe('test-pubkey');
    });

    it('登録簿と current に同じ鍵があっても重複させない', () => {
      seedRegistry([directEntry]);
      mockLocalStorage.nosskey_keyinfo = JSON.stringify(directEntry);
      const nosskey = new NosskeyManager();

      expect(nosskey.findKeyInfosByCredentialId(CRED_ID_HEX)).toHaveLength(1);
    });

    it('返り値はディープコピーで、変更しても内部状態に影響しない', () => {
      seedRegistry([directEntry]);
      const nosskey = new NosskeyManager();

      const found = nosskey.findKeyInfosByCredentialId(CRED_ID_HEX);
      found[0].pubkey = 'mutated';

      expect(nosskey.findKeyInfosByCredentialId(CRED_ID_HEX)[0].pubkey).toBe('test-pubkey');
    });
  });
});
