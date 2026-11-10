import { describe, expect, it } from 'vitest';
import { toUnsignedEventTemplate } from './event-template.js';

describe('toUnsignedEventTemplate', () => {
  it('署名対象を決めるフィールドだけを残す', () => {
    const template = toUnsignedEventTemplate({
      kind: 1,
      content: 'hello',
      tags: [['t', 'nostr']],
      created_at: 1_700_000_000,
      id: 'a'.repeat(64),
      sig: 'b'.repeat(128),
      pubkey: 'c'.repeat(64),
      extra: 'ignored',
    });

    expect(template).toEqual({
      kind: 1,
      content: 'hello',
      tags: [['t', 'nostr']],
      created_at: 1_700_000_000,
    });
    expect(Object.keys(template).sort()).toEqual(['content', 'created_at', 'kind', 'tags']);
  });

  it('省略された tags / created_at は足さない', () => {
    expect(Object.keys(toUnsignedEventTemplate({ kind: 1, content: '' })).sort()).toEqual([
      'content',
      'kind',
    ]);
  });

  it('tags は写しを返し、後からの書き換えを受けない', () => {
    const tags = [['p', 'x']];
    const template = toUnsignedEventTemplate({ kind: 1, content: '', tags });
    tags[0][1] = 'y';
    tags.push(['e', 'z']);

    expect(template.tags).toEqual([['p', 'x']]);
  });

  it.each([
    ['null', null],
    ['文字列', 'event'],
    ['配列', []],
  ])('オブジェクト以外（%s）を拒否する', (_label, value) => {
    expect(() => toUnsignedEventTemplate(value)).toThrow('expected an object');
  });

  it.each([
    ['欠落', undefined],
    ['文字列', '1'],
    ['小数', 1.5],
    ['負数', -1],
    ['上限超過', 65536],
    ['NaN', Number.NaN],
  ])('不正な kind（%s）を拒否する', (_label, kind) => {
    expect(() => toUnsignedEventTemplate({ kind, content: '' })).toThrow('kind');
  });

  it.each([
    ['欠落', undefined],
    ['数値', 1],
    ['null', null],
  ])('不正な content（%s）を拒否する', (_label, content) => {
    expect(() => toUnsignedEventTemplate({ kind: 1, content })).toThrow('content');
  });

  it.each([
    ['kind の下限', { kind: 0, content: '' }],
    ['kind の上限', { kind: 65535, content: '' }],
    ['created_at が 0', { kind: 1, content: '', created_at: 0 }],
    ['空の tags', { kind: 1, content: '', tags: [] }],
    ['空のタグ', { kind: 1, content: '', tags: [[]] }],
  ])('境界値（%s）を受け入れる', (_label, event) => {
    expect(toUnsignedEventTemplate(event)).toEqual(event);
  });

  it.each([
    ['null', null],
    ['文字列', 'tags'],
    ['配列でない要素', ['t']],
    ['文字列でない要素', [['t', 1]]],
    ['オブジェクトの要素', [['t', {}]]],
    // biome-ignore lint/suspicious/noSparseArray: 穴あき配列そのものが検証対象
    ['外側に穴のある配列', [, ['p', 'a']]],
    // biome-ignore lint/suspicious/noSparseArray: 穴あき配列そのものが検証対象
    ['内側に穴のある配列', [['t', , 'x']]],
    ['構造化複製を経た穴あき配列', structuredClone(Object.assign(new Array(2), { 1: ['p', 'a'] }))],
  ])('不正な tags（%s）を拒否する', (_label, tags) => {
    expect(() => toUnsignedEventTemplate({ kind: 1, content: '', tags })).toThrow('tags');
  });

  it.each([
    ['null', null],
    ['文字列', '1700000000'],
    ['小数', 1.5],
    ['負数', -1],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('不正な created_at（%s）を拒否する', (_label, created_at) => {
    expect(() => toUnsignedEventTemplate({ kind: 1, content: '', created_at })).toThrow(
      'created_at'
    );
  });

  it('検証した値と写した値が食い違わない（各要素を 1 回しか読まない）', () => {
    let reads = 0;
    const tag = new Proxy(['t', 'ok'], {
      get(target, key, receiver) {
        if (key === '1') {
          reads += 1;
          // 2 回目以降は文字列でない値を返し、読み直す実装なら写しに紛れ込む。
          return reads === 1 ? 'ok' : 42;
        }
        return Reflect.get(target, key, receiver);
      },
    });

    const template = toUnsignedEventTemplate({ kind: 1, content: '', tags: [tag] });

    expect(template.tags).toEqual([['t', 'ok']]);
    expect(reads).toBe(1);
  });

  it('エラーにイベントの内容を含めない', () => {
    const secret = 'do-not-leak-this-content';
    let message = '';
    try {
      toUnsignedEventTemplate({ kind: 'x', content: secret, tags: [[secret]] });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toContain(secret);
  });
});
