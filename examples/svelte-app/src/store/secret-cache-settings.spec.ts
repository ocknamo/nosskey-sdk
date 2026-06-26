import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CACHE_TTL_SECONDS,
  MAX_CACHE_TTL_SECONDS,
  MIN_CACHE_TTL_SECONDS,
  cacheTimeout,
  clampCacheTimeout,
} from './secret-cache-settings.js';

describe('clampCacheTimeout', () => {
  it('keeps values within the allowed range unchanged', () => {
    expect(clampCacheTimeout(MIN_CACHE_TTL_SECONDS)).toBe(MIN_CACHE_TTL_SECONDS);
    expect(clampCacheTimeout(300)).toBe(300);
    expect(clampCacheTimeout(MAX_CACHE_TTL_SECONDS)).toBe(MAX_CACHE_TTL_SECONDS);
  });

  it('clamps values below the minimum up to MIN', () => {
    expect(clampCacheTimeout(0)).toBe(MIN_CACHE_TTL_SECONDS);
    expect(clampCacheTimeout(-100)).toBe(MIN_CACHE_TTL_SECONDS);
    expect(clampCacheTimeout(MIN_CACHE_TTL_SECONDS - 1)).toBe(MIN_CACHE_TTL_SECONDS);
  });

  it('clamps values above the maximum down to MAX', () => {
    expect(clampCacheTimeout(MAX_CACHE_TTL_SECONDS + 1)).toBe(MAX_CACHE_TTL_SECONDS);
    expect(clampCacheTimeout(999999999)).toBe(MAX_CACHE_TTL_SECONDS);
  });

  it('falls back to the default for non-finite values', () => {
    expect(clampCacheTimeout(Number.NaN)).toBe(DEFAULT_CACHE_TTL_SECONDS);
    expect(clampCacheTimeout(Number.POSITIVE_INFINITY)).toBe(DEFAULT_CACHE_TTL_SECONDS);
    expect(clampCacheTimeout(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_CACHE_TTL_SECONDS);
  });

  it('floors fractional values', () => {
    expect(clampCacheTimeout(300.9)).toBe(300);
  });
});

describe('cacheTimeout store', () => {
  // モジュールシングルトンを共有するため各テスト前に既知値へ戻し、状態漏れを防ぐ。
  beforeEach(() => {
    cacheTimeout.set(DEFAULT_CACHE_TTL_SECONDS);
  });

  it('clamps on set so out-of-range values never reach subscribers', () => {
    cacheTimeout.set(999999999);
    expect(get(cacheTimeout)).toBe(MAX_CACHE_TTL_SECONDS);

    cacheTimeout.set(-5);
    expect(get(cacheTimeout)).toBe(MIN_CACHE_TTL_SECONDS);

    cacheTimeout.set(300);
    expect(get(cacheTimeout)).toBe(300);
  });

  it('clamps the result of update() at both ends', () => {
    cacheTimeout.set(300);
    cacheTimeout.update((v) => v * 100000);
    expect(get(cacheTimeout)).toBe(MAX_CACHE_TTL_SECONDS);

    cacheTimeout.set(300);
    cacheTimeout.update((v) => v - 100000);
    expect(get(cacheTimeout)).toBe(MIN_CACHE_TTL_SECONDS);
  });
});
