import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeClient } from './client.js';
import { createHarness } from './client.test-helpers.js';
import type { Harness } from './client.test-helpers.js';

describe('NosskeyIframeClient', () => {
  let harness: Harness;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('nip44 / nip04 namespaces', () => {
    const peerPub = 'b'.repeat(64);

    it('nip44.encrypt sends the right request and resolves with ciphertext', async () => {
      const client = new NosskeyIframeClient({
        iframeUrl: 'https://nosskey.example/iframe',
        window: harness.window,
        document: harness.document,
        container: harness.container as unknown as HTMLElement,
      });
      const iframe = harness.iframes[0];
      const pending = client.nip44.encrypt(peerPub, 'plain');
      const [request] = iframe.contentWindow.postMessage.mock.calls[0];
      expect(request).toMatchObject({
        type: 'nosskey:request',
        method: 'nip44_encrypt',
        params: { pubkey: peerPub, plaintext: 'plain' },
      });
      harness.dispatchAsIframe({
        type: 'nosskey:response',
        id: request.id,
        result: 'cipher-payload',
      });
      await expect(pending).resolves.toBe('cipher-payload');
      client.destroy();
    });

    it('nip44.decrypt sends ciphertext and resolves with plaintext', async () => {
      const client = new NosskeyIframeClient({
        iframeUrl: 'https://nosskey.example/iframe',
        window: harness.window,
        document: harness.document,
        container: harness.container as unknown as HTMLElement,
      });
      const iframe = harness.iframes[0];
      const pending = client.nip44.decrypt(peerPub, 'cipher-payload');
      const [request] = iframe.contentWindow.postMessage.mock.calls[0];
      expect(request).toMatchObject({
        method: 'nip44_decrypt',
        params: { pubkey: peerPub, ciphertext: 'cipher-payload' },
      });
      harness.dispatchAsIframe({
        type: 'nosskey:response',
        id: request.id,
        result: 'plain',
      });
      await expect(pending).resolves.toBe('plain');
      client.destroy();
    });

    it('nip04 namespace mirrors nip44 shape', async () => {
      const client = new NosskeyIframeClient({
        iframeUrl: 'https://nosskey.example/iframe',
        window: harness.window,
        document: harness.document,
        container: harness.container as unknown as HTMLElement,
      });
      const iframe = harness.iframes[0];
      const enc = client.nip04.encrypt(peerPub, 'p');
      const [encReq] = iframe.contentWindow.postMessage.mock.calls[0];
      expect(encReq.method).toBe('nip04_encrypt');
      harness.dispatchAsIframe({ type: 'nosskey:response', id: encReq.id, result: 'cbc?iv=z' });
      await expect(enc).resolves.toBe('cbc?iv=z');

      const dec = client.nip04.decrypt(peerPub, 'cbc?iv=z');
      const [decReq] = iframe.contentWindow.postMessage.mock.calls[1];
      expect(decReq.method).toBe('nip04_decrypt');
      harness.dispatchAsIframe({ type: 'nosskey:response', id: decReq.id, result: 'p' });
      await expect(dec).resolves.toBe('p');

      client.destroy();
    });
  });
});
