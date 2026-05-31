import type { NostrKeyInfo } from 'nosskey-sdk';
import { describe, expect, it } from 'vitest';
import { isNostrKeyInfo } from '../store/accounts.js';
import { serializeKeyInfoForExport } from './key-info-export.js';

describe('serializeKeyInfoForExport', () => {
  const directModeKeyInfo: NostrKeyInfo = {
    credentialId: 'aabbcc',
    pubkey: '0011223344556677889900112233445566778899001122334455667788990011',
    salt: '6e6f7374722d70776b',
    username: 'alice',
  };

  const wrapModeKeyInfo: NostrKeyInfo = {
    credentialId: 'ddeeff',
    pubkey: 'ffeeddccbbaa00998877665544332211ffeeddccbbaa009988776655443322110',
    salt: '6e6f7374722d70776b2d77726170',
    wrapped: { v: 1, alg: 'nip44-v2', payload: 'base64payload==' },
  };

  it('KeyInfo オブジェクトそのものを直列化する（関数自身ではない）', () => {
    const json = serializeKeyInfoForExport(directModeKeyInfo);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(directModeKeyInfo);
  });

  // 元バグ（エクスポート関数自身を直列化していた）の回帰防止。
  // 関数を直列化すると `JSON.stringify` は undefined を返すため、
  // インポート側の型ガードを必ず弾く。出力は往復で必ず通ること。
  it('出力がインポート側の isNostrKeyInfo 検証を通る（往復成立）', () => {
    for (const keyInfo of [directModeKeyInfo, wrapModeKeyInfo]) {
      const json = serializeKeyInfoForExport(keyInfo);
      const parsed: unknown = JSON.parse(json);
      expect(isNostrKeyInfo(parsed)).toBe(true);
    }
  });

  it('pretty-print（2 スペースインデント）で出力する', () => {
    const json = serializeKeyInfoForExport(directModeKeyInfo);
    expect(json).toContain('\n  "credentialId"');
  });
});
