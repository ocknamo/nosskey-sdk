import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from './nav-items.js';

describe('NAV_ITEMS', () => {
  it('フッター / ヘッダーのナビに apps を含む 4 画面を並べる', () => {
    expect(NAV_ITEMS.map((item) => item.screen)).toEqual(['account', 'key', 'apps', 'settings']);
  });
});
