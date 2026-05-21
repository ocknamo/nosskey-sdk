// @vitest-environment happy-dom
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  OTHER_PUBKEY,
  OTHER_SK,
  TEST_PUBKEY,
  TEST_SK,
  buildSignedKind0,
} from '../services/kind0-test-utils.js';
import { PROFILE_CACHE_KEY } from '../services/profile-cache.js';
import { RELAYS_STORAGE_KEY } from '../services/relays-store.js';
import { publicKey } from './app-state.js';
import { clearCurrentProfile, currentProfile, loadProfileForPubkey } from './profile-store.js';

beforeEach(() => {
  publicKey.set(null);
  clearCurrentProfile();
  localStorage.clear();
});

describe('loadProfileForPubkey', () => {
  it('リレー未設定なら fetch は呼ばれず loading=false で着地する', async () => {
    let called = false;
    await loadProfileForPubkey(TEST_PUBKEY, {
      relays: [],
      fetcherOptions: {
        wsFactory: () => {
          called = true;
          throw new Error('should not be called');
        },
      },
    });
    expect(called).toBe(false);
    expect(get(currentProfile)).toEqual({ picture: null, loading: false });
  });

  it('キャッシュがあれば即座に反映し、fetcher 結果で上書きする', async () => {
    localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({
        [TEST_PUBKEY]: {
          picture: 'https://cache.example/old.png',
          name: 'cached',
          updatedAt: 100,
        },
      })
    );

    const fakeWs = makeImmediateProfileFactory({
      picture: 'https://new.example/new.png',
      created_at: 500,
    });
    await loadProfileForPubkey(TEST_PUBKEY, {
      relays: ['wss://r'],
      fetcherOptions: { wsFactory: fakeWs, timeoutMs: 1000 },
    });
    const final = get(currentProfile);
    expect(final?.picture).toBe('https://new.example/new.png');
    expect(final?.loading).toBe(false);
  });

  it('fetcher が null を返したら loading=false に降格する', async () => {
    const fakeWs = makeImmediateProfileFactory(null);
    await loadProfileForPubkey(TEST_PUBKEY, {
      relays: ['wss://r'],
      fetcherOptions: { wsFactory: fakeWs, timeoutMs: 1000 },
    });
    expect(get(currentProfile)).toEqual({ picture: null, loading: false });
  });

  it('http URL は picture バリデーションで弾く', async () => {
    const fakeWs = makeImmediateProfileFactory({
      picture: 'http://example.com/x.png',
      created_at: 1,
    });
    await loadProfileForPubkey(TEST_PUBKEY, {
      relays: ['wss://r'],
      fetcherOptions: { wsFactory: fakeWs, timeoutMs: 1000 },
    });
    expect(get(currentProfile)?.picture).toBeNull();
  });

  it('loadRelays の read=true のみが対象になる', async () => {
    localStorage.setItem(
      RELAYS_STORAGE_KEY,
      JSON.stringify({
        'wss://read': { read: true, write: false },
        'wss://write-only': { read: false, write: true },
      })
    );
    const visited: string[] = [];
    const fakeWs = (url: string) => {
      visited.push(url);
      return immediateProfileSocket(url, { picture: 'https://x/a.png', created_at: 10 });
    };
    await loadProfileForPubkey(TEST_PUBKEY, {
      fetcherOptions: { wsFactory: fakeWs, timeoutMs: 1000 },
    });
    expect(visited).toEqual(['wss://read']);
  });

  it('clearCurrentProfile で currentProfile が null になる', () => {
    currentProfile.set({ picture: 'https://x', loading: false });
    clearCurrentProfile();
    expect(get(currentProfile)).toBeNull();
  });

  it('wsFactory が throw しても catch されて loading=false に降格する', async () => {
    const factory = () => {
      throw new Error('boom');
    };
    await loadProfileForPubkey(TEST_PUBKEY, {
      relays: ['wss://r'],
      fetcherOptions: { wsFactory: factory, timeoutMs: 1000 },
    });
    expect(get(currentProfile)).toEqual({ picture: null, loading: false });
  });

  it('pubkey 切替で古い fetch の結果は破棄される', async () => {
    // 古い pubkey 向けの fetch をスタートし、応答前に新 pubkey でロードを掛ける
    let releaseOld: (() => void) | null = null;
    const stallingFactory = (_url: string) => {
      const ws = {
        readyState: 0,
        onopen: null as (() => void) | null,
        onmessage: null as ((ev: { data: string }) => void) | null,
        onerror: null as (() => void) | null,
        onclose: null as (() => void) | null,
        send(_data: string) {
          /* 何もしない: 応答を保留し、外部 release で発火 */
        },
        close() {
          this.readyState = 3;
          this.onclose?.();
        },
      };
      queueMicrotask(() => {
        ws.readyState = 1;
        ws.onopen?.();
        releaseOld = () => {
          ws.onmessage?.({
            data: JSON.stringify([
              'EVENT',
              'sub-old',
              buildSignedKind0(TEST_SK, { picture: 'https://old.example/p.png' }, 1),
            ]),
          });
        };
      });
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 fake
      return ws as any;
    };

    const oldPromise = loadProfileForPubkey(TEST_PUBKEY, {
      relays: ['wss://old'],
      fetcherOptions: { wsFactory: stallingFactory, timeoutMs: 500 },
    });
    // 古い fetch の onopen まで進める
    await Promise.resolve();
    await Promise.resolve();

    // 新 pubkey でリロード（即時 EOSE で settle する factory）
    const newPromise = loadProfileForPubkey(OTHER_PUBKEY, {
      relays: ['wss://new'],
      fetcherOptions: {
        wsFactory: (url: string) =>
          immediateProfileSocketForKey(url, OTHER_SK, {
            picture: 'https://new.example/p.png',
            created_at: 999,
          }),
        timeoutMs: 500,
      },
    });

    // 古い方を解放（既に inflightToken が進んでいるので破棄される）
    releaseOld?.();
    await newPromise;
    await oldPromise;

    const final = get(currentProfile);
    expect(final?.picture).toBe('https://new.example/p.png');
  });
});

function immediateProfileSocketForKey(
  _url: string,
  sk: Uint8Array,
  result: { picture?: string; created_at: number }
): WebSocket {
  type Listener = ((ev: { data: string }) => void) | (() => void) | null;
  const ws = {
    readyState: 0,
    onopen: null as Listener,
    onmessage: null as ((ev: { data: string }) => void) | null,
    onerror: null as Listener,
    onclose: null as Listener,
    send(this: typeof ws, data: string) {
      const msg = JSON.parse(data);
      if (msg[0] !== 'REQ') return;
      const subId = msg[1];
      queueMicrotask(() => {
        this.onmessage?.({
          data: JSON.stringify([
            'EVENT',
            subId,
            buildSignedKind0(sk, { picture: result.picture }, result.created_at),
          ]),
        });
        this.onmessage?.({ data: JSON.stringify(['EOSE', subId]) });
      });
    },
    close(this: typeof ws) {
      this.readyState = 3;
      (this.onclose as (() => void) | null)?.();
    },
  };
  queueMicrotask(() => {
    ws.readyState = 1;
    (ws.onopen as (() => void) | null)?.();
  });
  // biome-ignore lint/suspicious/noExplicitAny: テスト用 fake
  return ws as any;
}

// --- 共通の fake WebSocket ヘルパー ---

function immediateProfileSocket(
  _url: string,
  result: { picture?: string; name?: string; created_at: number } | null
): WebSocket {
  type Listener = ((ev: { data: string }) => void) | (() => void) | null;
  const ws = {
    readyState: 0,
    onopen: null as Listener,
    onmessage: null as ((ev: { data: string }) => void) | null,
    onerror: null as Listener,
    onclose: null as Listener,
    send(this: typeof ws, data: string) {
      const msg = JSON.parse(data);
      if (msg[0] !== 'REQ') return;
      const subId = msg[1];
      queueMicrotask(() => {
        if (result) {
          this.onmessage?.({
            data: JSON.stringify([
              'EVENT',
              subId,
              buildSignedKind0(
                TEST_SK,
                { picture: result.picture, name: result.name },
                result.created_at
              ),
            ]),
          });
        }
        this.onmessage?.({ data: JSON.stringify(['EOSE', subId]) });
      });
    },
    close(this: typeof ws) {
      this.readyState = 3;
      (this.onclose as (() => void) | null)?.();
    },
  };
  queueMicrotask(() => {
    ws.readyState = 1;
    (ws.onopen as (() => void) | null)?.();
  });
  // biome-ignore lint/suspicious/noExplicitAny: テスト用 fake は WebSocket 型互換ではない
  return ws as any;
}

function makeImmediateProfileFactory(
  result: { picture?: string; name?: string; created_at: number } | null
): (url: string) => WebSocket {
  return (url: string) => immediateProfileSocket(url, result);
}
