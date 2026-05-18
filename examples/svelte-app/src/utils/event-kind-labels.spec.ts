import { describe, expect, it } from 'vitest';
import { type KindLabelMap, kindLabel } from './event-kind-labels.js';

// 各フィールドに自身の名前を入れて、どのラベルが返ったか一意に判定する。
const labels: KindLabelMap = {
  metadata: 'metadata',
  textNote: 'textNote',
  follows: 'follows',
  legacyDm: 'legacyDm',
  repost: 'repost',
  reaction: 'reaction',
  channelMessage: 'channelMessage',
  rumor: 'rumor',
  seal: 'seal',
  giftWrap: 'giftWrap',
  longForm: 'longForm',
  unknown: 'unknown',
};

describe('kindLabel', () => {
  it.each([
    [0, 'metadata'],
    [1, 'textNote'],
    [3, 'follows'],
    [4, 'legacyDm'],
    [6, 'repost'],
    [7, 'reaction'],
    [13, 'rumor'],
    [14, 'seal'],
    [42, 'channelMessage'],
    [1059, 'giftWrap'],
    [30023, 'longForm'],
  ])('maps kind %d to its dedicated label', (kind, expected) => {
    expect(kindLabel(kind, labels)).toBe(expected);
  });

  it.each([2, 5, 8, 100, 9999, -1])('returns the unknown label for unmapped kind %d', (kind) => {
    expect(kindLabel(kind, labels)).toBe('unknown');
  });
});
