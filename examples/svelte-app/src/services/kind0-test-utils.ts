/**
 * テスト用に schnorr 署名付きの kind:0 イベントを生成するヘルパー。
 *
 * profile-fetcher に署名検証が入ったため、固定の偽 `sig` を持つモックでは
 * テストが通らない。`profile-fetcher.spec.ts` と `profile-store.spec.ts` から
 * 共有して使う。
 */

import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const TEST_SK = new Uint8Array(32).fill(1);
export const OTHER_SK = new Uint8Array(32).fill(2);

export const TEST_PUBKEY = bytesToHex(schnorr.getPublicKey(TEST_SK));
export const OTHER_PUBKEY = bytesToHex(schnorr.getPublicKey(OTHER_SK));

export interface SignedKind0 {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  sig: string;
}

/**
 * 与えた秘密鍵で署名した kind:0 イベントを返す。
 * `content` がオブジェクトなら JSON 化、文字列ならそのまま `content` に使う
 * （不正な JSON を `content` に持つ署名済みイベントもテストできる）。
 */
export function buildSignedKind0(
  sk: Uint8Array,
  content: object | string,
  created_at: number
): SignedKind0 {
  const pubkey = bytesToHex(schnorr.getPublicKey(sk));
  const tags: string[][] = [];
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  const serialized = JSON.stringify([0, pubkey, created_at, 0, tags, contentStr]);
  const idBytes = sha256(new TextEncoder().encode(serialized));
  const sig = bytesToHex(schnorr.sign(idBytes, sk));
  return {
    id: bytesToHex(idBytes),
    kind: 0,
    pubkey,
    created_at,
    content: contentStr,
    tags,
    sig,
  };
}
