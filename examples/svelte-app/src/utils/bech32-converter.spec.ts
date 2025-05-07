import { describe, expect, test } from 'vitest';
import {
  hexToNpub,
  hexToNsec,
  isValidNpub,
  isValidNsec,
  npubToHex,
  nsecToHex,
} from './bech32-converter.js';

describe('bech32Converter', () => {
  // NIP-19に記載されているテストデータ
  const pubkeyHex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
  const npubFormat = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6';

  const privkeyHex = '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa';
  const nsecFormat = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

  const invalidNpub = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w7'; // 末尾変更
  const invalidNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe6'; // 末尾変更
  const notNpub = 'note1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5'; // prefixが違う

  describe('hexToNpub', () => {
    test('公開鍵の16進数をnpubフォーマットに変換できること', () => {
      const result = hexToNpub(pubkeyHex);
      expect(result).toBe(npubFormat);
    });
  });

  describe('npubToHex', () => {
    test('npubフォーマットを16進数に変換できること', () => {
      const result = npubToHex(npubFormat);
      expect(result).toBe(pubkeyHex);
    });

    test('無効なnpubフォーマットの場合はnullを返すこと', () => {
      const result = npubToHex('invalid-npub');
      expect(result).toBeNull();
    });

    test('正しい形式だがprefixがnpubでない場合はエラーを返すこと', () => {
      const result = npubToHex(notNpub);
      expect(result).toBeNull();
    });
  });

  describe('hexToNsec', () => {
    test('秘密鍵の16進数をnsecフォーマットに変換できること', () => {
      const result = hexToNsec(privkeyHex);
      expect(result).toBe(nsecFormat);
    });
  });

  describe('nsecToHex', () => {
    test('nsecフォーマットを16進数に変換できること', () => {
      const result = nsecToHex(nsecFormat);
      expect(result).toBe(privkeyHex);
    });

    test('無効なnsecフォーマットの場合はnullを返すこと', () => {
      const result = nsecToHex('invalid-nsec');
      expect(result).toBeNull();
    });

    test('正しい形式だがprefixがnsecでない場合はエラーを返すこと', () => {
      const result = nsecToHex(notNpub);
      expect(result).toBeNull();
    });
  });

  describe('isValidNpub', () => {
    test('有効なnpubフォーマットの場合はtrueを返すこと', () => {
      const result = isValidNpub(npubFormat);
      expect(result).toBe(true);
    });

    test('無効なnpubフォーマットの場合はfalseを返すこと', () => {
      const result = isValidNpub('invalid-npub');
      expect(result).toBe(false);
    });

    test('チェックサムエラーのnpubの場合はfalseを返すこと', () => {
      const result = isValidNpub(invalidNpub);
      expect(result).toBe(false);
    });
  });

  describe('isValidNsec', () => {
    test('有効なnsecフォーマットの場合はtrueを返すこと', () => {
      const result = isValidNsec(nsecFormat);
      expect(result).toBe(true);
    });

    test('無効なnsecフォーマットの場合はfalseを返すこと', () => {
      const result = isValidNsec('invalid-nsec');
      expect(result).toBe(false);
    });

    test('チェックサムエラーのnsecの場合はfalseを返すこと', () => {
      const result = isValidNsec(invalidNsec);
      expect(result).toBe(false);
    });
  });

  describe('変換の整合性', () => {
    test('hex -> npub -> hex の変換が元の値と一致すること', () => {
      const npub = hexToNpub(pubkeyHex);
      const hex = npubToHex(npub);
      expect(hex).toBe(pubkeyHex);
    });

    test('hex -> nsec -> hex の変換が元の値と一致すること', () => {
      const nsec = hexToNsec(privkeyHex);
      const hex = nsecToHex(nsec);
      expect(hex).toBe(privkeyHex);
    });
  });
});
