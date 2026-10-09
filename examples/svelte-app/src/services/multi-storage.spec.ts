import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiStorage } from './multi-storage.js';

class MemoryStorage implements Storage {
  #map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.#map.has(key) ? (this.#map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.#map.set(key, value);
  }
  removeItem(key: string): void {
    this.#map.delete(key);
  }
  clear(): void {
    this.#map.clear();
  }
  key(index: number): string | null {
    return Array.from(this.#map.keys())[index] ?? null;
  }
  get length(): number {
    return this.#map.size;
  }
}

describe('MultiStorage', () => {
  let primary: MemoryStorage;
  let mirror: MemoryStorage;
  let multi: MultiStorage;

  beforeEach(() => {
    primary = new MemoryStorage();
    mirror = new MemoryStorage();
    multi = new MultiStorage({ primary, mirrors: [mirror] });
  });

  it('setItem は primary と mirror 両方に書き込む', () => {
    multi.setItem('k', 'v');
    expect(primary.getItem('k')).toBe('v');
    expect(mirror.getItem('k')).toBe('v');
  });

  it('getItem は primary 優先で読む', () => {
    primary.setItem('k', 'from-primary');
    mirror.setItem('k', 'from-mirror');
    expect(multi.getItem('k')).toBe('from-primary');
  });

  it('primary が空で mirror にある場合は mirror から読み、primary に back-fill する', () => {
    mirror.setItem('k', 'mirrored');
    expect(multi.getItem('k')).toBe('mirrored');
    // back-fill 確認
    expect(primary.getItem('k')).toBe('mirrored');
  });

  it('mirror も無ければ null を返す', () => {
    expect(multi.getItem('k')).toBeNull();
  });

  it('mirror の setItem 失敗は primary 書き込みを巻き込まない', () => {
    const flakyMirror: Storage = {
      ...new MemoryStorage(),
      setItem: vi.fn(() => {
        throw new Error('boom');
      }),
    } as unknown as Storage;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = new MultiStorage({ primary, mirrors: [flakyMirror] });
    expect(() => m.setItem('k', 'v')).not.toThrow();
    expect(primary.getItem('k')).toBe('v');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('removeItem は primary と mirror 両方から削除する', () => {
    multi.setItem('k', 'v');
    multi.removeItem('k');
    expect(primary.getItem('k')).toBeNull();
    expect(mirror.getItem('k')).toBeNull();
  });

  it('mirror の removeItem 失敗は primary 削除を巻き込まない', () => {
    const flakyMirror: Storage = {
      ...new MemoryStorage(),
      removeItem: vi.fn(() => {
        throw new Error('boom');
      }),
    } as unknown as Storage;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    primary.setItem('k', 'v');
    const m = new MultiStorage({ primary, mirrors: [flakyMirror] });
    expect(() => m.removeItem('k')).not.toThrow();
    expect(primary.getItem('k')).toBeNull();
    warn.mockRestore();
  });

  it('複数 mirror をサポートする', () => {
    const m2 = new MemoryStorage();
    const m = new MultiStorage({ primary, mirrors: [mirror, m2] });
    m.setItem('k', 'v');
    expect(mirror.getItem('k')).toBe('v');
    expect(m2.getItem('k')).toBe('v');
  });

  it('length / key は primary を委譲する', () => {
    primary.setItem('a', '1');
    primary.setItem('b', '2');
    mirror.setItem('c', '3'); // mirror 専有
    expect(multi.length).toBe(2);
    expect(multi.key(0)).toBe('a');
    expect(multi.key(1)).toBe('b');
  });

  it('primary の setItem が throw すれば呼び出し元に伝播する（容量超過等の致命的障害）', () => {
    const failingPrimary: Storage = {
      ...new MemoryStorage(),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    } as unknown as Storage;
    const m = new MultiStorage({ primary: failingPrimary, mirrors: [mirror] });
    expect(() => m.setItem('k', 'v')).toThrow('QuotaExceededError');
  });

  it('back-fill 時に primary の setItem が throw しても getItem は mirror の値を返す', () => {
    const flakyPrimary: Storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('quota');
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    } as unknown as Storage;
    mirror.setItem('k', 'from-mirror');
    const m = new MultiStorage({ primary: flakyPrimary, mirrors: [mirror] });
    expect(m.getItem('k')).toBe('from-mirror');
  });

  it('mirror の getItem が throw すれば次の mirror に進む', () => {
    const mirror2 = new MemoryStorage();
    mirror2.setItem('k', 'from-second-mirror');
    const failingMirror: Storage = {
      ...new MemoryStorage(),
      getItem: vi.fn(() => {
        throw new Error('boom');
      }),
    } as unknown as Storage;
    const m = new MultiStorage({ primary, mirrors: [failingMirror, mirror2] });
    expect(m.getItem('k')).toBe('from-second-mirror');
  });

  it('clear は primary と全 mirror をクリアする', () => {
    multi.setItem('a', '1');
    multi.setItem('b', '2');
    multi.clear();
    expect(primary.length).toBe(0);
    expect(mirror.length).toBe(0);
  });

  it('clear: mirror が throw しても primary はクリアされる', () => {
    const flakyMirror: Storage = {
      ...new MemoryStorage(),
      clear: vi.fn(() => {
        throw new Error('boom');
      }),
    } as unknown as Storage;
    primary.setItem('k', 'v');
    const m = new MultiStorage({ primary, mirrors: [flakyMirror] });
    expect(() => m.clear()).not.toThrow();
    expect(primary.length).toBe(0);
  });
});
