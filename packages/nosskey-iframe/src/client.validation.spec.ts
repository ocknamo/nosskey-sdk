import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeClient } from './client.js';
import { createHarness } from './client.test-helpers.js';
import type { Harness } from './client.test-helpers.js';
import type { NostrEvent } from './types.js';

describe('NosskeyIframeClient', () => {
  let harness: Harness;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('result type validation', () => {
    const mkClient = () =>
      new NosskeyIframeClient({
        iframeUrl: 'https://nosskey.example/iframe',
        window: harness.window,
        document: harness.document,
        container: harness.container as unknown as HTMLElement,
      });

    it('getPublicKey rejects when the iframe returns a non-string result', async () => {
      const client = mkClient();
      const pending = client.getPublicKey();
      const [request] = harness.iframes[0].contentWindow.postMessage.mock.calls[0];
      harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: 42 });
      await expect(pending).rejects.toThrow(/expected string result/);
      client.destroy();
    });

    it('getRelays rejects when the iframe returns a non-object result', async () => {
      const client = mkClient();
      const pending = client.getRelays();
      const [request] = harness.iframes[0].contentWindow.postMessage.mock.calls[0];
      harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: 'not-object' });
      await expect(pending).rejects.toThrow(/expected object result/);
      client.destroy();
    });

    it('signEvent rejects when the iframe returns a non-object result', async () => {
      const client = mkClient();
      const pending = client.signEvent({ kind: 1, content: 'hi' });
      const [request] = harness.iframes[0].contentWindow.postMessage.mock.calls[0];
      harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: 'not-object' });
      await expect(pending).rejects.toThrow(/expected NostrEvent result/);
      client.destroy();
    });

    it('nip44.encrypt rejects when the iframe returns a non-string result', async () => {
      const client = mkClient();
      const pending = client.nip44.encrypt('b'.repeat(64), 'plain');
      const [request] = harness.iframes[0].contentWindow.postMessage.mock.calls[0];
      harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: {} });
      await expect(pending).rejects.toThrow(/nip44\.encrypt: expected string result/);
      client.destroy();
    });

    it('nip44.decrypt rejects when the iframe returns a non-string result', async () => {
      const client = mkClient();
      const pending = client.nip44.decrypt('b'.repeat(64), 'cipher');
      const [request] = harness.iframes[0].contentWindow.postMessage.mock.calls[0];
      harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: 7 });
      await expect(pending).rejects.toThrow(/nip44\.decrypt: expected string result/);
      client.destroy();
    });

    it('nip04.encrypt rejects when the iframe returns a non-string result', async () => {
      const client = mkClient();
      const pending = client.nip04.encrypt('b'.repeat(64), 'plain');
      const [request] = harness.iframes[0].contentWindow.postMessage.mock.calls[0];
      harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: null });
      await expect(pending).rejects.toThrow(/nip04\.encrypt: expected string result/);
      client.destroy();
    });

    it('nip04.decrypt rejects when the iframe returns a non-string result', async () => {
      const client = mkClient();
      const pending = client.nip04.decrypt('b'.repeat(64), 'cipher');
      const [request] = harness.iframes[0].contentWindow.postMessage.mock.calls[0];
      harness.dispatchAsIframe({ type: 'nosskey:response', id: request.id, result: false });
      await expect(pending).rejects.toThrow(/nip04\.decrypt: expected string result/);
      client.destroy();
    });
  });

  describe('lifecycle and option validation', () => {
    it('ready() rejects when destroy() is called before the iframe is ready', async () => {
      const client = new NosskeyIframeClient({
        iframeUrl: 'https://nosskey.example/iframe',
        window: harness.window,
        document: harness.document,
        container: harness.container as unknown as HTMLElement,
      });
      const readyPromise = client.ready();
      client.destroy();
      await expect(readyPromise).rejects.toThrow(/destroyed before ready/);
    });

    it('throws when no Window is available', () => {
      vi.stubGlobal('window', undefined);
      try {
        expect(
          () => new NosskeyIframeClient({ iframeUrl: 'https://nosskey.example/iframe' })
        ).toThrow(/requires a Window/);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('throws when no Document is available', () => {
      const windowWithoutDocument = {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      } as unknown as Window;
      expect(
        () =>
          new NosskeyIframeClient({
            iframeUrl: 'https://nosskey.example/iframe',
            window: windowWithoutDocument,
          })
      ).toThrow(/requires a Document/);
    });

    it('throws when no container element can be determined', () => {
      const docWithoutBody = { body: null } as unknown as Document;
      expect(
        () =>
          new NosskeyIframeClient({
            iframeUrl: 'https://nosskey.example/iframe',
            window: harness.window,
            document: docWithoutBody,
          })
      ).toThrow(/could not determine a container/);
    });

    it('makeId falls back to a non-crypto id when crypto.randomUUID is unavailable', () => {
      (harness.window as unknown as { crypto: unknown }).crypto = {};
      const client = new NosskeyIframeClient({
        iframeUrl: 'https://nosskey.example/iframe',
        window: harness.window,
        document: harness.document,
        container: harness.container as unknown as HTMLElement,
      });
      const pending = client.getPublicKey();
      pending.catch(() => undefined);
      const [request] = harness.iframes[0].contentWindow.postMessage.mock.calls[0];
      expect(request.id).toMatch(/^nosskey-/);
      client.destroy();
    });

    it('exposes the mounted iframe element via the iframe getter', () => {
      const client = new NosskeyIframeClient({
        iframeUrl: 'https://nosskey.example/iframe',
        window: harness.window,
        document: harness.document,
        container: harness.container as unknown as HTMLElement,
      });
      expect(client.iframe).toBe(harness.iframes[0] as unknown as HTMLIFrameElement);
      client.destroy();
    });

    it('rejects requests issued after destroy()', async () => {
      const client = new NosskeyIframeClient({
        iframeUrl: 'https://nosskey.example/iframe',
        window: harness.window,
        document: harness.document,
        container: harness.container as unknown as HTMLElement,
      });
      client.destroy();
      await expect(client.getPublicKey()).rejects.toThrow(/has been destroyed/);
    });
  });
});
