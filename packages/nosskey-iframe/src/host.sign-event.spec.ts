import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentRequest } from './host.js';
import { NosskeyIframeHost } from './host.js';
import type { DispatchableWindow } from './host.test-helpers.js';
import { createFakeWindow, makeManager } from './host.test-helpers.js';
import { isNosskeyVisibility } from './protocol.js';
import type { NostrEvent } from './types.js';

const ORIGIN = 'https://parent.example';

function setup(onConsent: (request: ConsentRequest) => Promise<boolean> = async () => true) {
  const win = createFakeWindow() as DispatchableWindow;
  // A separate parent, so visibility messages are actually posted and can be observed.
  const parent = { postMessage: vi.fn() };
  Object.defineProperty(win, 'parent', { value: parent, configurable: true });
  const manager = makeManager({
    signEvent: vi.fn(async (event: NostrEvent) => ({ ...event, id: 'i', sig: 's' })),
  });
  const consent = vi.fn(onConsent);
  const host = new NosskeyIframeHost({
    manager,
    allowedOrigins: [ORIGIN],
    onConsent: consent,
    window: win as unknown as Window,
  });
  host.start();
  const sign = (event: unknown) =>
    win.dispatchMessage(
      { type: 'nosskey:request', id: 'r', method: 'signEvent', params: { event } },
      ORIGIN
    );
  const response = () =>
    win.sent.find((m) => (m.data as { type?: string }).type === 'nosskey:response')?.data as {
      result?: NostrEvent;
      error?: { code: string; message: string };
    };
  const visibility = () =>
    parent.postMessage.mock.calls.map((call) => call[0]).filter(isNosskeyVisibility);
  return { manager, consent, host, sign, response, visibility };
}

describe('NosskeyIframeHost signEvent payload', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('drops caller-supplied id / sig / pubkey before consent and signing', async () => {
    const { manager, consent, host, sign, visibility } = setup();

    await sign({
      kind: 1,
      content: 'gm',
      tags: [['t', 'nostr']],
      created_at: 1_800_000_000,
      id: 'a'.repeat(64),
      sig: 'b'.repeat(128),
      pubkey: 'c'.repeat(64),
      extra: 'ignored',
    });

    const expected = {
      kind: 1,
      content: 'gm',
      tags: [['t', 'nostr']],
      created_at: 1_800_000_000,
    };
    const shown = consent.mock.calls[0][0].event as NostrEvent;
    const signedInput = vi.mocked(manager.signEvent).mock.calls[0][0];
    expect(Object.keys(shown).sort()).toEqual(['content', 'created_at', 'kind', 'tags']);
    expect(shown).toEqual(expected);
    expect(signedInput).toEqual(expected);
    // Guards the INVALID_REQUEST cases below against passing vacuously.
    expect(visibility().map((m) => m.visible)).toEqual([true, false]);
    host.stop();
  });

  it('signs the very object the consent handler was shown', async () => {
    const { manager, consent, host, sign } = setup();

    await sign({ kind: 1, content: 'gm', id: 'a'.repeat(64) });

    expect(vi.mocked(manager.signEvent).mock.calls[0][0]).toBe(consent.mock.calls[0][0].event);
    host.stop();
  });

  it('does not add tags / created_at the caller left out', async () => {
    const { manager, host, sign } = setup();

    await sign({ kind: 1, content: 'gm' });

    expect(Object.keys(vi.mocked(manager.signEvent).mock.calls[0][0]).sort()).toEqual([
      'content',
      'kind',
    ]);
    host.stop();
  });

  it("hands over a copy of the tags, not the caller's arrays", async () => {
    const { manager, host, sign } = setup();
    const tags = [['p', 'x']];

    await sign({ kind: 1, content: 'gm', tags });
    tags[0][1] = 'y';

    const signedInput = vi.mocked(manager.signEvent).mock.calls[0][0];
    expect(signedInput.tags).not.toBe(tags);
    expect(signedInput.tags?.[0]).not.toBe(tags[0]);
    expect(signedInput.tags).toEqual([['p', 'x']]);
    host.stop();
  });

  it.each([
    ['the lowest kind', { kind: 0, content: '' }],
    ['the highest kind', { kind: 65535, content: '' }],
    ['a zero created_at', { kind: 1, content: '', created_at: 0 }],
    ['empty tags', { kind: 1, content: '', tags: [] }],
    ['an empty tag', { kind: 1, content: '', tags: [[]] }],
  ])('accepts %s', async (_label, event) => {
    const { manager, host, sign, response } = setup();

    await sign(event);

    expect(response().error).toBeUndefined();
    expect(vi.mocked(manager.signEvent).mock.calls[0][0]).toEqual(event);
    host.stop();
  });

  it.each([
    ['a non-object event', 'event'],
    ['an array event', []],
    ['a missing kind', { content: '' }],
    ['a fractional kind', { kind: 1.5, content: '' }],
    ['a negative kind', { kind: -1, content: '' }],
    ['an out-of-range kind', { kind: 65536, content: '' }],
    ['a string kind', { kind: '1', content: '' }],
    ['a missing content', { kind: 1 }],
    ['a non-string content', { kind: 1, content: 1 }],
    ['non-array tags', { kind: 1, content: '', tags: 'tags' }],
    ['a non-array tag', { kind: 1, content: '', tags: ['t'] }],
    ['a non-string tag item', { kind: 1, content: '', tags: [['t', 1]] }],
    // Structured clone keeps the holes of a sparse array, so a parent can send one.
    [
      'tags with a hole',
      { kind: 1, content: '', tags: structuredClone(Object.assign(new Array(2), { 1: ['p'] })) },
    ],
    [
      'a tag with a hole',
      { kind: 1, content: '', tags: [structuredClone(Object.assign(new Array(2), { 0: 't' }))] },
    ],
    ['a string created_at', { kind: 1, content: '', created_at: '1' }],
    ['a fractional created_at', { kind: 1, content: '', created_at: 1.5 }],
    ['a negative created_at', { kind: 1, content: '', created_at: -1 }],
  ])('answers INVALID_REQUEST for %s without asking for consent', async (_label, event) => {
    const { manager, consent, host, sign, response, visibility } = setup();

    await sign(event);

    expect(response().error?.code).toBe('INVALID_REQUEST');
    expect(consent).not.toHaveBeenCalled();
    expect(manager.signEvent).not.toHaveBeenCalled();
    // The iframe is never revealed for a request that cannot be signed.
    expect(visibility()).toEqual([]);
    host.stop();
  });
});
