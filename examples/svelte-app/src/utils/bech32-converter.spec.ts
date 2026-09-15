import { describe, expect, it, test, vi } from 'vitest';
import {
  hexToNpub,
  hexToNsec,
  isValidNpub,
  isValidNsec,
  npubToHex,
  nsecToHex,
  shortenNpub,
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

  describe('shortenNpub', () => {
    test('hex を 先頭head…末尾tail の短縮 npub にすること', () => {
      // npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6
      expect(shortenNpub(pubkeyHex)).toBe('npub180cvv07…wsyjh6w6');
    });

    test('head / tail を指定できること（同意ダイアログ用の 8/8）', () => {
      expect(shortenNpub(pubkeyHex, 8, 8)).toBe('npub180c…wsyjh6w6');
    });

    test('npub 変換に失敗する入力は hex 短縮にフォールバックすること', () => {
      // 長すぎる入力は bech32 の長さ制限超過で encode が throw する。
      const bad = 'a'.repeat(200);
      expect(shortenNpub(bad)).toBe(`${bad.slice(0, 8)}…${bad.slice(-8)}`);
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

// 回帰ガード: bech32@2 は失敗メッセージへ**入力文字列そのもの**を連結する
// （`Invalid checksum for <入力>` 等）。計測モード（?debug=1）のパネルは console を
// 全取り込みしてログ全文が共有されるため、ここで入力を出すと打ち間違えた nsec が
// 外部へ持ち出される。分類名だけを出す不変条件を固定する。
describe('変換エラーのログに入力文字列を出さない', () => {
  const HEX = '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa';
  const validNsec = hexToNsec(HEX) as string;
  const validNpub = hexToNpub(HEX) as string;

  /** `console.error` に渡された全引数を 1 本の文字列に畳む。 */
  function loggedText(spy: { mock: { calls: unknown[][] } }): string {
    return spy.mock.calls.map((call) => call.join(' ')).join('\n');
  }

  // いずれも bech32 が入力を埋め込むメッセージを投げるケース。
  const cases: { label: string; input: string }[] = [
    // checksum 不正: 正しい nsec のデータ部を 1 文字書き換える
    { label: 'invalid checksum', input: `${validNsec.slice(0, -5)}qqqqq` },
    // セパレータ無し
    { label: 'no separator', input: 'nsecabcdefghijklmnopqrstuvwxyz' },
    // 大文字小文字混在
    { label: 'mixed case', input: `N${validNsec.slice(1)}` },
    // 短すぎる
    { label: 'too short', input: 'nsec1q' },
  ];

  it.each(cases)('nsecToHex は入力を含まない分類名だけを出す ($label)', ({ input }) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(nsecToHex(input)).toBeNull();
    const logged = loggedText(spy);
    expect(logged).not.toContain(input);
    // 入力の一部（データ部の断片）も漏れていないこと
    expect(logged).not.toContain(input.slice(5, 20));
    expect(logged).toContain('変換エラー');
    spy.mockRestore();
  });

  it('npubToHex も同じ扱いにする', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const input = `${validNpub.slice(0, -5)}qqqqq`;
    expect(npubToHex(input)).toBeNull();
    expect(loggedText(spy)).not.toContain(input);
    spy.mockRestore();
  });

  it('prefix 違いは分類名として読めるまま残す（切り分け性を落とさない）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // 正しい bech32 だが prefix が nsec ではない → 自作メッセージ経路
    expect(nsecToHex(validNpub)).toBeNull();
    expect(loggedText(spy)).toContain('Not an nsec format');
    spy.mockRestore();
  });
});
