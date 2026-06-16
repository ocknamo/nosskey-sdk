import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes, hexToBytesStrict } from './utils.js';

describe('バイト変換ユーティリティ', () => {
  describe('bytesToHex', () => {
    it('Uint8Array を16進数文字列に変換できること', () => {
      // 'hello' をASCIIコードで表すと [104, 101, 108, 108, 111]
      const input = new Uint8Array([104, 101, 108, 108, 111]);
      expect(bytesToHex(input)).toBe('68656c6c6f');
    });

    it('空のバイト配列を空の文字列に変換できること', () => {
      const input = new Uint8Array([]);
      expect(bytesToHex(input)).toBe('');
    });

    it('様々なバイト値を正しく変換できること', () => {
      const input = new Uint8Array([0, 15, 16, 255]);
      expect(bytesToHex(input)).toBe('000f10ff');
    });
  });

  describe('hexToBytes', () => {
    it('16進数文字列をUint8Arrayに変換できること', () => {
      const input = '68656c6c6f'; // 'hello' のASCII 16進数表現
      const expected = new Uint8Array([104, 101, 108, 108, 111]);
      const result = hexToBytes(input);

      expect(result instanceof Uint8Array).toBe(true);
      expect(result.length).toBe(expected.length);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(expected[i]);
      }
    });

    it('大文字の16進数文字列も変換できること', () => {
      const input = '68656C6C6F'; // 大文字で'hello'のASCII 16進数表現
      const expected = new Uint8Array([104, 101, 108, 108, 111]);
      const result = hexToBytes(input);

      expect(result.length).toBe(expected.length);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(expected[i]);
      }
    });

    it('空の文字列を空のバイト配列に変換できること', () => {
      const input = '';
      expect(hexToBytes(input).length).toBe(0);
    });

    it('奇数長の16進数文字列を適切に処理できること', () => {
      // "a" は4ビット分しかないため、そのバイトは完成せず保存されない
      const input = 'a';
      const result = hexToBytes(input);
      expect(result.length).toBe(0);
    });

    it('非16進数文字をスキップできること', () => {
      const input = '68 65-6c.6c/6f'; // スペースやハイフン等を含む
      const expected = new Uint8Array([104, 101, 108, 108, 111]);
      const result = hexToBytes(input);

      expect(result.length).toBe(expected.length);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(expected[i]);
      }
    });
  });

  describe('hexToBytesStrict', () => {
    it('正しい16進数文字列を変換できること', () => {
      const result = hexToBytesStrict('68656c6c6f');
      expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
    });

    it('大文字の16進数文字列も変換できること', () => {
      expect(Array.from(hexToBytesStrict('0F10FF'))).toEqual([15, 16, 255]);
    });

    it('空文字列を空配列に変換できること', () => {
      expect(hexToBytesStrict('').length).toBe(0);
    });

    it('expectedBytes と一致する場合は変換できること', () => {
      const hex = '00'.repeat(32);
      expect(hexToBytesStrict(hex, 32).length).toBe(32);
    });

    it('非16進数文字を含む場合は throw すること（黙ってスキップしない）', () => {
      // いずれも偶数長（長さチェックを通過させ非hexチェックを確実に発火させる）
      expect(() => hexToBytesStrict('68  6c')).toThrow(/non-hex/);
      expect(() => hexToBytesStrict('zz')).toThrow(/non-hex/);
      expect(() => hexToBytesStrict('00gg')).toThrow(/non-hex/);
    });

    it('奇数長の場合は throw すること（黙って切り捨てない）', () => {
      expect(() => hexToBytesStrict('abc')).toThrow(/odd-length/);
      expect(() => hexToBytesStrict('a')).toThrow(/odd-length/);
    });

    it('expectedBytes と長さが一致しない場合は throw すること', () => {
      expect(() => hexToBytesStrict('0011', 32)).toThrow(/expected 32 byte/);
      expect(() => hexToBytesStrict('', 32)).toThrow(/expected 32 byte/);
    });

    it('エラーメッセージに入力値そのものを含めないこと', () => {
      const secretLikeHex = 'deadbeefcafebabe';
      // 奇数長にして throw させる
      expect(() => hexToBytesStrict(`${secretLikeHex}a`)).toThrow();
      try {
        hexToBytesStrict(`${secretLikeHex}a`);
      } catch (e) {
        expect((e as Error).message).not.toContain(secretLikeHex);
      }
    });
  });

  describe('bytesToBase64', () => {
    it('Uint8Array を base64 文字列に変換できること', () => {
      // 'hello' をASCIIコードで表すと [104, 101, 108, 108, 111]
      const input = new Uint8Array([104, 101, 108, 108, 111]);
      expect(bytesToBase64(input)).toBe('aGVsbG8=');
    });

    it('空のバイト配列を空の文字列に変換できること', () => {
      expect(bytesToBase64(new Uint8Array([]))).toBe('');
    });

    it('非ASCIIのバイト値も変換できること', () => {
      const input = new Uint8Array([0, 15, 16, 128, 255]);
      expect(bytesToBase64(input)).toBe('AA8QgP8=');
    });
  });

  describe('base64ToBytes', () => {
    it('base64 文字列を Uint8Array に変換できること', () => {
      const result = base64ToBytes('aGVsbG8=');
      expect(result instanceof Uint8Array).toBe(true);
      expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
    });

    it('空の文字列を空のバイト配列に変換できること', () => {
      expect(base64ToBytes('').length).toBe(0);
    });
  });

  describe('bytesToBase64 / base64ToBytes ラウンドトリップ', () => {
    it('ASCII データを往復変換しても一致すること', () => {
      const input = new Uint8Array([104, 101, 108, 108, 111]);
      expect(Array.from(base64ToBytes(bytesToBase64(input)))).toEqual(Array.from(input));
    });

    it('バイナリ（非ASCII）データを往復変換しても一致すること', () => {
      const input = new Uint8Array([0, 15, 16, 128, 200, 255]);
      expect(Array.from(base64ToBytes(bytesToBase64(input)))).toEqual(Array.from(input));
    });
  });
});
