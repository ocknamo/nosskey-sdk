// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchKind0Profile } from './profile-fetcher.js';

/**
 * リレー WebSocket を真似た fake。`onopen` を即座に呼ぶことでテスト側からの
 * REQ → EVENT/EOSE シナリオをスクリプトできる。`script` 関数で send 受信ごとに
 * 任意の onmessage を発火させる。
 */
class FakeWebSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  static instances: FakeWebSocket[] = [];

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(data: string) {
    if (this.closed) return;
    this.sent.push(data);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }

  emit(data: unknown) {
    if (this.closed) return;
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

function freshFactory(): (url: string) => WebSocket {
  FakeWebSocket.instances = [];
  return (url: string) => new FakeWebSocket(url) as unknown as WebSocket;
}

afterEach(() => {
  FakeWebSocket.instances = [];
});

function buildKind0(pubkey: string, content: object, created_at: number) {
  return {
    id: 'fake',
    kind: 0,
    pubkey,
    created_at,
    content: JSON.stringify(content),
    tags: [],
    sig: '',
  };
}

const PUBKEY = 'a'.repeat(64);

describe('fetchKind0Profile', () => {
  it('relays が空なら null を返す（接続を試みない）', async () => {
    const factory = freshFactory();
    const result = await fetchKind0Profile(PUBKEY, [], { wsFactory: factory });
    expect(result).toBeNull();
    expect(FakeWebSocket.instances.length).toBe(0);
  });

  it('EVENT→EOSE で picture を抽出して返す', async () => {
    const factory = freshFactory();
    const promise = fetchKind0Profile(PUBKEY, ['wss://relay.example'], {
      wsFactory: factory,
      timeoutMs: 1000,
    });
    // microtask で onopen が走るまで待つ
    await Promise.resolve();
    await Promise.resolve();
    const ws = FakeWebSocket.instances[0];
    expect(ws.sent.length).toBe(1);
    const sent = JSON.parse(ws.sent[0]);
    expect(sent[0]).toBe('REQ');
    const subId = sent[1];
    ws.emit([
      'EVENT',
      subId,
      buildKind0(PUBKEY, { picture: 'https://x/a.png', name: 'alice' }, 1000),
    ]);
    ws.emit(['EOSE', subId]);
    const result = await promise;
    expect(result?.picture).toBe('https://x/a.png');
    expect(result?.name).toBe('alice');
    expect(result?.created_at).toBe(1000);
    // CLOSE が送られ socket がクローズされる
    expect(ws.sent[ws.sent.length - 1]).toContain('CLOSE');
    expect(ws.closed).toBe(true);
  });

  it('複数リレーで created_at の最新を採用する', async () => {
    const factory = freshFactory();
    const promise = fetchKind0Profile(PUBKEY, ['wss://a', 'wss://b'], {
      wsFactory: factory,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    await Promise.resolve();
    const [wsA, wsB] = FakeWebSocket.instances;
    const subA = JSON.parse(wsA.sent[0])[1];
    const subB = JSON.parse(wsB.sent[0])[1];
    wsA.emit(['EVENT', subA, buildKind0(PUBKEY, { picture: 'https://a/old.png' }, 100)]);
    wsA.emit(['EOSE', subA]);
    wsB.emit(['EVENT', subB, buildKind0(PUBKEY, { picture: 'https://b/new.png' }, 200)]);
    wsB.emit(['EOSE', subB]);
    const result = await promise;
    expect(result?.picture).toBe('https://b/new.png');
    expect(result?.created_at).toBe(200);
  });

  it('期待しない pubkey の EVENT は無視する', async () => {
    const factory = freshFactory();
    const promise = fetchKind0Profile(PUBKEY, ['wss://a'], {
      wsFactory: factory,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    await Promise.resolve();
    const ws = FakeWebSocket.instances[0];
    const sub = JSON.parse(ws.sent[0])[1];
    ws.emit(['EVENT', sub, buildKind0('b'.repeat(64), { picture: 'https://evil/x' }, 999)]);
    ws.emit(['EOSE', sub]);
    expect(await promise).toBeNull();
  });

  it('content が不正な JSON のイベントは無視する', async () => {
    const factory = freshFactory();
    const promise = fetchKind0Profile(PUBKEY, ['wss://a'], {
      wsFactory: factory,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    await Promise.resolve();
    const ws = FakeWebSocket.instances[0];
    const sub = JSON.parse(ws.sent[0])[1];
    ws.emit(['EVENT', sub, { kind: 0, pubkey: PUBKEY, created_at: 1, content: '{not-json' }]);
    ws.emit(['EOSE', sub]);
    expect(await promise).toBeNull();
  });

  it('タイムアウトで socket をクローズし null を返す', async () => {
    vi.useFakeTimers();
    try {
      const factory = freshFactory();
      const promise = fetchKind0Profile(PUBKEY, ['wss://a'], {
        wsFactory: factory,
        timeoutMs: 100,
      });
      await vi.advanceTimersByTimeAsync(0);
      const ws = FakeWebSocket.instances[0];
      // EVENT/EOSE 何も送らずタイマー進める
      await vi.advanceTimersByTimeAsync(200);
      expect(ws.closed).toBe(true);
      expect(await promise).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('wsFactory が例外を投げてもクラッシュしない', async () => {
    const factory = () => {
      throw new Error('boom');
    };
    expect(
      await fetchKind0Profile(PUBKEY, ['wss://a'], {
        wsFactory: factory,
        timeoutMs: 100,
      })
    ).toBeNull();
  });

  it('socket onerror が発火した場合は null を返してクローズする', async () => {
    const factory = freshFactory();
    const promise = fetchKind0Profile(PUBKEY, ['wss://a'], {
      wsFactory: factory,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    await Promise.resolve();
    const ws = FakeWebSocket.instances[0];
    ws.onerror?.();
    expect(await promise).toBeNull();
    expect(ws.closed).toBe(true);
  });

  it('全リレーが応答しないと null を返す（onclose 経由）', async () => {
    const factory = freshFactory();
    const promise = fetchKind0Profile(PUBKEY, ['wss://a', 'wss://b'], {
      wsFactory: factory,
      timeoutMs: 1000,
    });
    await Promise.resolve();
    await Promise.resolve();
    // どちらの socket も EOSE 来ずにクローズ
    for (const ws of FakeWebSocket.instances) ws.close();
    expect(await promise).toBeNull();
  });
});
