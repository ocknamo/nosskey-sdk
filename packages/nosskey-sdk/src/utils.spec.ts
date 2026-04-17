import { describe, expect, it } from 'vitest';
import { bytesToHex, hexToBytes } from './utils.js';

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
});
