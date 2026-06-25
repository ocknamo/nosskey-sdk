import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PENDING_PRF_TTL_MS, PendingPrfCache } from './pending-prf-cache.js';

describe('PendingPrfCache', () => {
  const credId = new Uint8Array(16).fill(1);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('store', () => {
    it('standard / wrap のいずれも無ければ何も保存しない（no-op）', () => {
      const cache = new PendingPrfCache();
      cache.store(credId, {});
      // 何も保存されていないので consume は undefined
      expect(cache.consume(credId, 'standard')).toBeUndefined();
      expect(cache.consume(credId, 'wrap')).toBeUndefined();
    });

    it('同一 credentialId への再 store は旧バッファをゼロ化してから上書きする', () => {
      const cache = new PendingPrfCache();
      const oldStandard = new Uint8Array(32).fill(7);
      cache.store(credId, { standard: oldStandard });

      const newStandard = new Uint8Array(32).fill(9);
      cache.store(credId, { standard: newStandard });

      // 旧バッファはゼロ化される
      expect(Array.from(oldStandard)).toEqual(Array.from(new Uint8Array(32)));
      // 上書き後の値が consume で取れる
      expect(cache.consume(credId, 'standard')).toBe(newStandard);
    });
  });

  describe('consume', () => {
    it('credentialId が undefined なら undefined を返す', () => {
      const cache = new PendingPrfCache();
      cache.store(credId, { standard: new Uint8Array(32).fill(3) });
      expect(cache.consume(undefined, 'standard')).toBeUndefined();
    });

    it('エントリが無ければ undefined を返す', () => {
      const cache = new PendingPrfCache();
      expect(cache.consume(credId, 'standard')).toBeUndefined();
    });

    it('該当 kind の値が無ければ undefined を返す（エントリは存在するが別 kind のみ）', () => {
      const cache = new PendingPrfCache();
      cache.store(credId, { standard: new Uint8Array(32).fill(3) });
      // wrap は保存していない
      expect(cache.consume(credId, 'wrap')).toBeUndefined();
    });

    it('消費すると相方バッファをゼロ化してエントリごと破棄する', () => {
      const cache = new PendingPrfCache();
      const standard = new Uint8Array(32).fill(3);
      const wrap = new Uint8Array(32).fill(4);
      cache.store(credId, { standard, wrap });

      const got = cache.consume(credId, 'standard');
      expect(got).toBe(standard);
      // 相方 (wrap) はゼロ化される
      expect(Array.from(wrap)).toEqual(Array.from(new Uint8Array(32)));
      // エントリは破棄済みなので 2 回目はもう取れない
      expect(cache.consume(credId, 'wrap')).toBeUndefined();
    });

    it('消費後は TTL タイマーが発火してもエラーにならない（タイマー解除済み）', () => {
      const cache = new PendingPrfCache();
      cache.store(credId, { standard: new Uint8Array(32).fill(3) });
      cache.consume(credId, 'standard');
      // 解除済みタイマーが残っていないことを間接確認
      expect(() => vi.advanceTimersByTime(PENDING_PRF_TTL_MS)).not.toThrow();
    });
  });

  describe('TTL 自動ゼロ化', () => {
    it('未消費のまま TTL を過ぎるとゼロ化されて取れなくなる', () => {
      const cache = new PendingPrfCache();
      const standard = new Uint8Array(32).fill(5);
      cache.store(credId, { standard });

      vi.advanceTimersByTime(PENDING_PRF_TTL_MS);

      expect(Array.from(standard)).toEqual(Array.from(new Uint8Array(32)));
      expect(cache.consume(credId, 'standard')).toBeUndefined();
    });

    it('コンストラクタで TTL を上書きできる', () => {
      const cache = new PendingPrfCache(1_000);
      const standard = new Uint8Array(32).fill(5);
      cache.store(credId, { standard });

      vi.advanceTimersByTime(999);
      expect(cache.consume(credId, 'standard')).toBe(standard);

      // 再 store して短い TTL の発火を確認
      const again = new Uint8Array(32).fill(6);
      cache.store(credId, { standard: again });
      vi.advanceTimersByTime(1_000);
      expect(cache.consume(credId, 'standard')).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('全エントリをゼロ化して破棄する', () => {
      const cache = new PendingPrfCache();
      const a = new Uint8Array(32).fill(1);
      const b = new Uint8Array(32).fill(2);
      cache.store(new Uint8Array(16).fill(1), { standard: a });
      cache.store(new Uint8Array(16).fill(2), { wrap: b });

      cache.clearAll();

      expect(Array.from(a)).toEqual(Array.from(new Uint8Array(32)));
      expect(Array.from(b)).toEqual(Array.from(new Uint8Array(32)));
      expect(cache.consume(new Uint8Array(16).fill(1), 'standard')).toBeUndefined();
      expect(cache.consume(new Uint8Array(16).fill(2), 'wrap')).toBeUndefined();
    });

    it('空でも安全に呼べる', () => {
      const cache = new PendingPrfCache();
      expect(() => cache.clearAll()).not.toThrow();
    });
  });
});
