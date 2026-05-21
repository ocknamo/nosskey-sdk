// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RELAY_URLS, RELAYS_STORAGE_KEY, loadRelays, saveRelays } from './relays-store.js';

const sortedDefaults = [...DEFAULT_RELAY_URLS].sort();

beforeEach(() => {
  localStorage.clear();
});

describe('loadRelays', () => {
  it('未保存時はデフォルトリレー（read+write）を返す', () => {
    const relays = loadRelays();
    expect(Object.keys(relays).sort()).toEqual(sortedDefaults);
    for (const url of DEFAULT_RELAY_URLS) {
      expect(relays[url]).toEqual({ read: true, write: true });
    }
  });

  it('明示的に保存された空マップ {} はそのまま尊重する', () => {
    localStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify({}));
    expect(loadRelays()).toEqual({});
  });

  it('保存済みのリレーマップをそのまま返す', () => {
    const custom = { 'wss://my.relay': { read: true, write: false } };
    localStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(custom));
    expect(loadRelays()).toEqual(custom);
  });

  it('壊れた JSON はデフォルトにフォールバックする', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(RELAYS_STORAGE_KEY, '{not-json');
    expect(Object.keys(loadRelays()).sort()).toEqual(sortedDefaults);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('オブジェクトでない値（配列）はデフォルトにフォールバックする', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify([1, 2]));
    expect(Object.keys(loadRelays()).sort()).toEqual(sortedDefaults);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('返すデフォルトは毎回新しいオブジェクトで、変更が次回に漏れない', () => {
    const first = loadRelays();
    const url = DEFAULT_RELAY_URLS[0];
    first[url].read = false;
    const second = loadRelays();
    expect(second[url].read).toBe(true);
  });

  it('storage が利用できない環境でもデフォルトを返す', () => {
    vi.stubGlobal('localStorage', undefined);
    try {
      expect(Object.keys(loadRelays()).sort()).toEqual(sortedDefaults);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('saveRelays', () => {
  it('save→load でラウンドトリップする', () => {
    const custom = { 'wss://a': { read: true, write: true } };
    saveRelays(custom);
    expect(loadRelays()).toEqual(custom);
  });

  it('空マップを保存するとデフォルトに戻らず空のまま読み戻せる', () => {
    saveRelays({});
    expect(loadRelays()).toEqual({});
  });
});
