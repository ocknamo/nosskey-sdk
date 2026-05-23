import { describe, expect, it, vi } from 'vitest';
import {
  STANDALONE_HANDOFF_TYPE,
  isStandaloneHandoffMessage,
  notifyOpenerIfSameOrigin,
  processStandaloneHandoff,
} from './opener-handoff.js';

const VALID_KEYINFO = {
  credentialId: 'aa11',
  pubkey: 'bb22',
  salt: 'cc33',
};

function makeWindowWithOpener(
  postMessage: (message: unknown, targetOrigin: string) => void = () => {}
): Window {
  const opener: Partial<Window> = { postMessage: postMessage as Window['postMessage'] };
  const win: Partial<Window> = {
    opener,
    location: { origin: 'https://nosskey.app' } as Location,
  };
  return win as Window;
}

describe('isStandaloneHandoffMessage', () => {
  it('完全な NostrKeyInfo を含むメッセージを受理する', () => {
    expect(
      isStandaloneHandoffMessage({
        type: STANDALONE_HANDOFF_TYPE,
        keyInfo: VALID_KEYINFO,
      })
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['プリミティブ (number)', 42],
    ['プリミティブ (string)', 'hello'],
    ['不正な type', { type: 'something-else', keyInfo: VALID_KEYINFO }],
    ['type が無い', { keyInfo: VALID_KEYINFO }],
    ['keyInfo が無い', { type: STANDALONE_HANDOFF_TYPE }],
    [
      'credentialId が string でない',
      { type: STANDALONE_HANDOFF_TYPE, keyInfo: { credentialId: 1, pubkey: 'x', salt: 'y' } },
    ],
    [
      'pubkey が string でない',
      { type: STANDALONE_HANDOFF_TYPE, keyInfo: { credentialId: 'x', pubkey: null, salt: 'y' } },
    ],
    [
      'salt が string でない',
      { type: STANDALONE_HANDOFF_TYPE, keyInfo: { credentialId: 'x', pubkey: 'y' } },
    ],
  ])('%s は拒否する', (_label, value) => {
    expect(isStandaloneHandoffMessage(value)).toBe(false);
  });
});

describe('notifyOpenerIfSameOrigin', () => {
  it('opener が存在するとき、自 origin を targetOrigin として postMessage する', () => {
    const post = vi.fn();
    const win = makeWindowWithOpener(post);
    notifyOpenerIfSameOrigin(VALID_KEYINFO, win);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      { type: STANDALONE_HANDOFF_TYPE, keyInfo: VALID_KEYINFO },
      'https://nosskey.app'
    );
  });

  it('opener が null なら何もしない', () => {
    const post = vi.fn();
    const win = {
      opener: null,
      location: { origin: 'https://nosskey.app' } as Location,
    } as unknown as Window;
    notifyOpenerIfSameOrigin(VALID_KEYINFO, win);
    expect(post).not.toHaveBeenCalled();
  });

  it('opener が自分自身なら何もしない (top-level)', () => {
    const post = vi.fn();
    const win = {
      location: { origin: 'https://nosskey.app' } as Location,
    } as unknown as Window;
    (win as unknown as { opener: Window }).opener = win;
    notifyOpenerIfSameOrigin(VALID_KEYINFO, win);
    expect(post).not.toHaveBeenCalled();
  });

  it('opener.postMessage が throw しても呼び出し元は影響を受けない', () => {
    const post = vi.fn(() => {
      throw new Error('opener closed');
    });
    const win = makeWindowWithOpener(post);
    expect(() => notifyOpenerIfSameOrigin(VALID_KEYINFO, win)).not.toThrow();
  });
});

describe('processStandaloneHandoff', () => {
  const ORIGIN = 'https://nosskey.app';
  // `event.source` の同一性比較に使う dummy 値。実体は問わない。
  const SOURCE = { id: 'opened-tab' } as unknown as Window;

  function validEvent(overrides: Partial<{ origin: string; source: unknown; data: unknown }> = {}) {
    return {
      origin: overrides.origin ?? ORIGIN,
      source: (overrides.source ?? SOURCE) as Window,
      data: overrides.data ?? { type: STANDALONE_HANDOFF_TYPE, keyInfo: VALID_KEYINFO },
    };
  }

  it('正しい origin / source / data なら keyInfo を返す', () => {
    expect(processStandaloneHandoff(validEvent(), { origin: ORIGIN, source: SOURCE })).toEqual(
      VALID_KEYINFO
    );
  });

  it('origin が違えば null', () => {
    expect(
      processStandaloneHandoff(validEvent({ origin: 'https://evil.example' }), {
        origin: ORIGIN,
        source: SOURCE,
      })
    ).toBeNull();
  });

  it('source が違えば null', () => {
    const otherSource = { id: 'other' } as unknown as Window;
    expect(
      processStandaloneHandoff(validEvent({ source: otherSource }), {
        origin: ORIGIN,
        source: SOURCE,
      })
    ).toBeNull();
  });

  it('expected.source が null（=自分が開いたタブがまだ無い）なら null', () => {
    expect(processStandaloneHandoff(validEvent(), { origin: ORIGIN, source: null })).toBeNull();
  });

  it('message 形式が不正なら null', () => {
    expect(
      processStandaloneHandoff(validEvent({ data: { type: 'wrong-type' } }), {
        origin: ORIGIN,
        source: SOURCE,
      })
    ).toBeNull();
  });

  it('keyInfo に必須フィールドが欠ければ null', () => {
    expect(
      processStandaloneHandoff(
        validEvent({ data: { type: STANDALONE_HANDOFF_TYPE, keyInfo: { pubkey: 'x' } } }),
        { origin: ORIGIN, source: SOURCE }
      )
    ).toBeNull();
  });
});
