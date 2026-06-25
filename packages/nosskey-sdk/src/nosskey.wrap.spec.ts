import { seckeySigner } from '@rx-nostr/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyManager } from './nosskey.js';
import { installWebAuthnMocks, mockCredentialId } from './nosskey.test-helpers.js';
import type { NostrEvent, NostrKeyInfo } from './types.js';
import { bytesToHex, hexToBytes } from './utils.js';

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

describe('NosskeyManager', () => {
  let webauthn: ReturnType<typeof installWebAuthnMocks>;

  beforeEach(() => {
    webauthn = installWebAuthnMocks();
  });

  afterEach(() => {
    webauthn.restore();
    vi.clearAllMocks();
  });

  describe('wrap モード（実値テスト）', () => {
    const TV_SECKEY_HEX = '0101010101010101010101010101010101010101010101010101010101010101';
    const TV_KEK_HEX = '4242424242424242424242424242424242424242424242424242424242424242';
    const TV_NONCE_HEX = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    const WRAP_SALT_HEX = '6e6f7374722d70776b2d77726170';

    let TV_IMPORTED_PUBKEY: string;
    let TV_KEK_PUBKEY: string;
    // 固定 nonce で決定論的に生成された wrapped.payload（テストベクトル）
    let TV_PAYLOAD_B64: string;

    beforeEach(async () => {
      const { schnorr } = await import('@noble/curves/secp256k1.js');
      const { nip44Encrypt: realNip44Encrypt } = await import('./nip44.js');

      TV_IMPORTED_PUBKEY = bytesToHex(schnorr.getPublicKey(hexToBytes(TV_SECKEY_HEX)));
      TV_KEK_PUBKEY = bytesToHex(schnorr.getPublicKey(hexToBytes(TV_KEK_HEX)));
      TV_PAYLOAD_B64 = realNip44Encrypt(
        TV_SECKEY_HEX,
        hexToBytes(TV_KEK_HEX),
        TV_KEK_PUBKEY,
        hexToBytes(TV_NONCE_HEX)
      );

      // seckeySigner モックを「sk hex から本物の secp256k1 x-only pubkey を返す」実装に差し替え。
      // signEvent はテスト判定用の固定値を返す（実 schnorr 署名検証はここではスコープ外）。
      vi.mocked(seckeySigner).mockImplementation(
        (skHex: string) =>
          ({
            getPublicKey: async () => bytesToHex(schnorr.getPublicKey(hexToBytes(skHex))),
            signEvent: vi.fn(async (event: NostrEvent) => ({
              ...event,
              id: 'wrap-mock-id',
              sig: 'wrap-mock-sig',
            })),
          }) as unknown as ReturnType<typeof seckeySigner>
      );
    });

    describe('importNostrKey', () => {
      it('正常系: 実物 nip44Encrypt で wrapped payload を生成し、復号で元の seckey に戻る', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
        });

        const seckey = hexToBytes(TV_SECKEY_HEX); // 新規バッファ（呼び出し後ゼロ化される想定）
        const result = await nosskey.importNostrKey(seckey);

        // 基本フィールドの assertion
        expect(result.pubkey).toBe(TV_IMPORTED_PUBKEY);
        expect(result.salt).toBe(WRAP_SALT_HEX);
        expect(result.wrapped).toBeDefined();
        expect(result.wrapped?.v).toBe(1);
        expect(result.wrapped?.alg).toBe('nip44-v2');
        expect(typeof result.wrapped?.payload).toBe('string');
        expect(result.wrapped?.payload.length).toBeGreaterThan(0);

        // 実物 nip44Decrypt で元の seckey hex に戻ることを確認（実値ラウンドトリップ）
        const { nip44Decrypt: realNip44Decrypt } = await import('./nip44.js');
        const decrypted = realNip44Decrypt(
          result.wrapped?.payload as string,
          hexToBytes(TV_KEK_HEX),
          TV_KEK_PUBKEY
        );
        expect(decrypted).toBe(TV_SECKEY_HEX);

        // 呼び出し後 seckey 入力バッファがゼロ化されている
        expect(Array.from(seckey)).toEqual(new Array(32).fill(0));
      });

      it('seckey が 32B 以外なら例外', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        await expect(nosskey.importNostrKey(new Uint8Array(31))).rejects.toThrow(
          'importNostrKey: seckey must be a 32-byte Uint8Array'
        );
      });

      it('seckey が 32B 以外でも Uint8Array なら入力バッファはゼロ化される', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const bad = new Uint8Array(31).fill(0x55);
        await expect(nosskey.importNostrKey(bad)).rejects.toThrow();
        expect(Array.from(bad)).toEqual(new Array(31).fill(0));
      });

      it('seckey が全 0 なら例外', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        await expect(nosskey.importNostrKey(new Uint8Array(32))).rejects.toThrow(
          'importNostrKey: invalid seckey (all zeros)'
        );
      });

      it('getPrfSecret 第3引数が WRAP_SALT', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        const spy = vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: new Uint8Array(),
        });
        await nosskey.importNostrKey(hexToBytes(TV_SECKEY_HEX));
        expect(spy.mock.calls[0][2]).toEqual(hexToBytes(WRAP_SALT_HEX));
      });

      it('username オプションが反映される', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: new Uint8Array(),
        });
        const result = await nosskey.importNostrKey(hexToBytes(TV_SECKEY_HEX), undefined, {
          username: 'alice',
        });
        expect(result.username).toBe('alice');
      });

      it('credentialId 明示指定時、その hex が NostrKeyInfo.credentialId に入る', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: new Uint8Array([0xff, 0xff]),
        });
        const result = await nosskey.importNostrKey(hexToBytes(TV_SECKEY_HEX), credId);
        expect(result.credentialId).toBe(bytesToHex(credId));
      });

      it('PRF 出力が全 0 なら例外（KEK ゼロ拒否）', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: new Uint8Array(32),
          id: new Uint8Array(),
        });
        await expect(nosskey.importNostrKey(hexToBytes(TV_SECKEY_HEX))).rejects.toThrow(
          'Invalid PRF output: all zeros'
        );
      });
    });

    describe('exportNostrKey: 固定 wrapped payload からの復号（実値ベクトルテスト）', () => {
      it('固定 wrapped payload + 固定 KEK → 元の seckey hex を完全復元', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: {
            v: 1,
            alg: 'nip44-v2',
            payload: TV_PAYLOAD_B64,
          },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        const exported = await nosskey.exportNostrKey(keyInfo);
        expect(exported).toBe(TV_SECKEY_HEX);
      });

      it('signEventWithKeyInfo は wrapped payload を復号して取り出した秘密鍵で署名する', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        const signed = await nosskey.signEventWithKeyInfo(
          { kind: 1, content: 'test', tags: [] },
          keyInfo
        );
        expect(signed.id).toBe('wrap-mock-id');
        expect(signed.sig).toBe('wrap-mock-sig');

        // seckeySigner が「復号された元の seckey hex」で呼ばれたことを確認
        const calls = vi.mocked(seckeySigner).mock.calls;
        const calledWithSeckey = calls.some(([sk]) => sk === TV_SECKEY_HEX);
        expect(calledWithSeckey).toBe(true);
      });

      it('nip44Encrypt → nip44Decrypt 自己ラウンドトリップ（wrap モード越し）', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        nosskey.setCurrentKeyInfo(keyInfo);
        const prfHandler = await import('./prf-handler.js');
        // 各呼び出しで新規バッファを返す（#getSecretKey が KEK を fill(0) するため）
        vi.spyOn(prfHandler, 'getPrfSecret').mockImplementation(async () => ({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        }));

        // peer 鍵は別の任意の seckey の pubkey
        const { schnorr } = await import('@noble/curves/secp256k1.js');
        const peerSk = new Uint8Array(32).fill(0x55);
        const peerPubHex = bytesToHex(schnorr.getPublicKey(peerSk));

        const ciphertext = await nosskey.nip44Encrypt(peerPubHex, 'hello wrap');
        expect(await nosskey.nip44Decrypt(peerPubHex, ciphertext)).toBe('hello wrap');
      });
    });

    describe('wrap モードの改竄検知', () => {
      it('wrapped.payload を 1 文字書き換え → exportNostrKey が MAC エラー', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        // ciphertext 部の base64 文字を1つ書き換える。先頭 ~12 文字はバージョン+nonce
        // の base64 表現なのでスキップ、後ろは MAC なのでスキップ。中間の文字を狙う。
        const idx = Math.floor(TV_PAYLOAD_B64.length / 2);
        const orig = TV_PAYLOAD_B64[idx];
        const swap = orig === 'A' ? 'B' : 'A';
        const tampered = TV_PAYLOAD_B64.slice(0, idx) + swap + TV_PAYLOAD_B64.slice(idx + 1);

        const credId = new Uint8Array(4);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: tampered },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        await expect(nosskey.exportNostrKey(keyInfo)).rejects.toThrow(/NIP-44/);
      });

      it('wrapped.alg !== "nip44-v2" → "Unsupported wrap algorithm" 例外', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(4);
        const keyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v3', payload: TV_PAYLOAD_B64 },
        } as unknown as NostrKeyInfo;
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        await expect(nosskey.exportNostrKey(keyInfo)).rejects.toThrow(
          'Unsupported wrap algorithm: nip44-v3'
        );
      });

      it('keyInfo.pubkey が改竄されている → 復号後の pubkey 照合で例外', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(4);
        // payload / KEK は正規だが、保存済み pubkey だけが別物に書き換えられている状況。
        // 改ざんされた pubkey は別 seckey から導出した有効な x-only pubkey にする。
        const { schnorr } = await import('@noble/curves/secp256k1.js');
        const tamperedPubkey = bytesToHex(schnorr.getPublicKey(new Uint8Array(32).fill(0x09)));
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: tamperedPubkey,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        await expect(nosskey.exportNostrKey(keyInfo)).rejects.toThrow(
          'Decrypted key does not match stored pubkey'
        );
      });

      it('別アカウントの pubkey と wrapped payload を取り違えた keyInfo → pubkey 照合で例外', async () => {
        // 改竄ではなく「別パスキー / 別 keyInfo の取り違え」シナリオ。
        // wrapped payload は TV_SECKEY で暗号化されているが、pubkey フィールドには
        // 別アカウント（別 seckey）の正規 pubkey が入っている。復号自体は成功するが
        // 導出 pubkey と保存 pubkey が食い違うため照合で弾かれることを固定する。
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(4);
        const { schnorr } = await import('@noble/curves/secp256k1.js');
        const otherAccountSeckey = new Uint8Array(32).fill(0x03);
        const otherAccountPubkey = bytesToHex(schnorr.getPublicKey(otherAccountSeckey));
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: otherAccountPubkey,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        await expect(nosskey.exportNostrKey(keyInfo)).rejects.toThrow(
          'Decrypted key does not match stored pubkey'
        );
      });

      it('keyInfo.pubkey が正規なら pubkey 照合を通過する（回帰）', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const credId = new Uint8Array(4);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        });

        await expect(nosskey.exportNostrKey(keyInfo)).resolves.toBe(TV_SECKEY_HEX);
      });
    });

    describe('保存値の厳格パース（#getSecretKey）', () => {
      // credentialId / salt は localStorage に平文保存され改ざんされ得るため、
      // 非hex文字を含む場合は黙ってスキップせず throw すること（hexToBytesStrict）。
      it('credentialId に非hex文字が含まれる → getPrfSecret 到達前に throw', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        const spy = vi.spyOn(prfHandler, 'getPrfSecret');
        const keyInfo: NostrKeyInfo = {
          credentialId: 'zz', // 偶数長だが非hex
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
        };

        await expect(nosskey.exportNostrKey(keyInfo)).rejects.toThrow(/non-hex/);
        // 厳格パースは getPrfSecret の引数評価時点で弾くため UV へ到達しない
        expect(spy).not.toHaveBeenCalled();
      });

      it('salt に非hex文字が含まれる → getPrfSecret 到達前に throw', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        const spy = vi.spyOn(prfHandler, 'getPrfSecret');
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(new Uint8Array(4)),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: 'zzzz', // 非hex（normalizeSalt は LEGACY/未設定以外を素通しするため throw に至る）
        };

        await expect(nosskey.exportNostrKey(keyInfo)).rejects.toThrow(/non-hex/);
        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('PRF 直接モード回帰', () => {
      it('createNostrKey は wrapped を生成しない', async () => {
        const nosskey = new NosskeyManager({ storageOptions: { enabled: false } });
        const prfHandler = await import('./prf-handler.js');
        vi.spyOn(prfHandler, 'getPrfSecret').mockResolvedValueOnce({
          secret: new Uint8Array(32).fill(42),
          id: mockCredentialId,
        });

        const result = await nosskey.createNostrKey(mockCredentialId);
        expect(result.wrapped).toBeUndefined();
        expect(result.salt).toBe('6e6f7374722d70776b'); // 直接モード salt
      });
    });

    describe('wrap モードと KeyCache の相互作用', () => {
      it('キャッシュ有効時でも exportNostrKey は毎回 getPrfSecret（UV）を呼ぶ', async () => {
        const nosskey = new NosskeyManager({
          cacheOptions: { enabled: true },
          storageOptions: { enabled: false },
        });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        const spy = vi.spyOn(prfHandler, 'getPrfSecret').mockImplementation(async () => ({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        }));

        const r1 = await nosskey.exportNostrKey(keyInfo);
        expect(r1).toBe(TV_SECKEY_HEX);
        expect(spy).toHaveBeenCalledTimes(1);

        // キャッシュ TTL 内でも export は必ず UV を要求する（キャッシュバイパス）
        const r2 = await nosskey.exportNostrKey(keyInfo);
        expect(r2).toBe(TV_SECKEY_HEX);
        expect(spy).toHaveBeenCalledTimes(2);
      });

      it('キャッシュ有効時、signEvent は2回目でキャッシュを利用して UV をスキップする', async () => {
        const nosskey = new NosskeyManager({
          cacheOptions: { enabled: true },
          storageOptions: { enabled: false },
        });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        const spy = vi.spyOn(prfHandler, 'getPrfSecret').mockImplementation(async () => ({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        }));
        const mockEvent = {
          kind: 1,
          content: 'test',
          tags: [],
          created_at: 0,
          pubkey: TV_IMPORTED_PUBKEY,
        };

        await nosskey.signEventWithKeyInfo(mockEvent, keyInfo);
        expect(spy).toHaveBeenCalledTimes(1);

        // sign の2回目はキャッシュヒット（UV なし）
        await nosskey.signEventWithKeyInfo(mockEvent, keyInfo);
        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('clearCachedKey 後は再度 getPrfSecret + NIP-44 復号が走る', async () => {
        const nosskey = new NosskeyManager({
          cacheOptions: { enabled: true },
          storageOptions: { enabled: false },
        });
        const credId = new Uint8Array(16).fill(7);
        const keyInfo: NostrKeyInfo = {
          credentialId: bytesToHex(credId),
          pubkey: TV_IMPORTED_PUBKEY,
          salt: WRAP_SALT_HEX,
          wrapped: { v: 1, alg: 'nip44-v2', payload: TV_PAYLOAD_B64 },
        };
        const prfHandler = await import('./prf-handler.js');
        const spy = vi.spyOn(prfHandler, 'getPrfSecret').mockImplementation(async () => ({
          secret: hexToBytes(TV_KEK_HEX),
          id: credId,
        }));

        await nosskey.exportNostrKey(keyInfo);
        nosskey.clearCachedKey(credId);
        await nosskey.exportNostrKey(keyInfo);
        expect(spy).toHaveBeenCalledTimes(2);
      });
    });
  });
});
