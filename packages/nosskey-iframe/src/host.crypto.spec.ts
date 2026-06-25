import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeHost } from './host.js';
import { createFakeWindow, makeManager } from './host.test-helpers.js';
import type { DispatchableWindow } from './host.test-helpers.js';

describe('NosskeyIframeHost', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('nip44 / nip04 encrypt / decrypt', () => {
    const peerPub = 'a'.repeat(64);

    it('routes nip44_encrypt after consent and exposes plaintext to the dialog', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const onConsent = vi.fn(async () => true);
      const manager = makeManager({
        nip44Encrypt: vi.fn(async () => 'cipher-text-payload'),
      });
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: ['https://parent.example'],
        onConsent,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id: 'n1',
          method: 'nip44_encrypt',
          params: { pubkey: peerPub, plaintext: 'secret' },
        },
        'https://parent.example'
      );
      expect(onConsent).toHaveBeenCalledWith({
        origin: 'https://parent.example',
        method: 'nip44_encrypt',
        pubkey: peerPub,
        plaintext: 'secret',
      });
      expect(manager.nip44Encrypt).toHaveBeenCalledWith(peerPub, 'secret');
      expect((win.sent[0].data as { result: string }).result).toBe('cipher-text-payload');
      host.stop();
    });

    it('omits plaintext from consent for nip44_decrypt', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const onConsent = vi.fn(async () => true);
      const manager = makeManager({
        nip44Decrypt: vi.fn(async () => 'decrypted'),
      });
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: ['https://parent.example'],
        onConsent,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id: 'n2',
          method: 'nip44_decrypt',
          params: { pubkey: peerPub, ciphertext: 'cipher' },
        },
        'https://parent.example'
      );
      const consentArg = onConsent.mock.calls[0][0];
      expect(consentArg.method).toBe('nip44_decrypt');
      expect(consentArg.pubkey).toBe(peerPub);
      expect(consentArg).not.toHaveProperty('plaintext');
      expect(manager.nip44Decrypt).toHaveBeenCalledWith(peerPub, 'cipher');
      host.stop();
    });

    it('routes nip04_encrypt and nip04_decrypt', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const manager = makeManager({
        nip04Encrypt: vi.fn(async () => 'cbc?iv=zz'),
        nip04Decrypt: vi.fn(async () => 'plain'),
      });
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: ['https://parent.example'],
        onConsent: async () => true,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id: 'n3',
          method: 'nip04_encrypt',
          params: { pubkey: peerPub, plaintext: 'hi' },
        },
        'https://parent.example'
      );
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id: 'n4',
          method: 'nip04_decrypt',
          params: { pubkey: peerPub, ciphertext: 'cbc?iv=zz' },
        },
        'https://parent.example'
      );
      expect(manager.nip04Encrypt).toHaveBeenCalledWith(peerPub, 'hi');
      expect(manager.nip04Decrypt).toHaveBeenCalledWith(peerPub, 'cbc?iv=zz');
      const results = win.sent
        .filter((m) => 'data' in m && (m.data as { type: string }).type === 'nosskey:response')
        .map((m) => (m.data as { result?: string }).result);
      expect(results).toContain('cbc?iv=zz');
      expect(results).toContain('plain');
      host.stop();
    });

    it('returns USER_REJECTED for nip44_encrypt when consent is denied', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const manager = makeManager({
        nip44Encrypt: vi.fn(async () => {
          throw new Error('should not be called');
        }),
      });
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: ['https://parent.example'],
        onConsent: async () => false,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id: 'n5',
          method: 'nip44_encrypt',
          params: { pubkey: peerPub, plaintext: 'x' },
        },
        'https://parent.example'
      );
      expect(manager.nip44Encrypt).not.toHaveBeenCalled();
      expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('USER_REJECTED');
      host.stop();
    });

    it('returns INVALID_REQUEST when params are missing', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const manager = makeManager();
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: ['https://parent.example'],
        onConsent: async () => true,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        { type: 'nosskey:request', id: 'n6', method: 'nip44_encrypt' },
        'https://parent.example'
      );
      expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
      host.stop();
    });

    it('returns INVALID_REQUEST when nip44_decrypt params are missing', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const host = new NosskeyIframeHost({
        manager: makeManager(),
        allowedOrigins: ['https://parent.example'],
        onConsent: async () => true,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        { type: 'nosskey:request', id: 'n7', method: 'nip44_decrypt' },
        'https://parent.example'
      );
      expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
      host.stop();
    });

    it('returns NO_KEY for nip44_decrypt when no key is configured', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const manager = makeManager({ hasKeyInfo: () => false });
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: ['https://parent.example'],
        onConsent: async () => true,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id: 'd1',
          method: 'nip44_decrypt',
          params: { pubkey: peerPub, ciphertext: 'cipher' },
        },
        'https://parent.example'
      );
      expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('NO_KEY');
      expect(manager.nip44Decrypt).not.toHaveBeenCalled();
      host.stop();
    });

    it('returns NO_KEY for nip04_decrypt when no key is configured', async () => {
      const win = createFakeWindow() as DispatchableWindow;
      const manager = makeManager({ hasKeyInfo: () => false });
      const host = new NosskeyIframeHost({
        manager,
        allowedOrigins: ['https://parent.example'],
        onConsent: async () => true,
        window: win as unknown as Window,
      });
      host.start();
      await win.dispatchMessage(
        {
          type: 'nosskey:request',
          id: 'd2',
          method: 'nip04_decrypt',
          params: { pubkey: peerPub, ciphertext: 'cbc?iv=zz' },
        },
        'https://parent.example'
      );
      expect((win.sent[0].data as { error: { code: string } }).error.code).toBe('NO_KEY');
      expect(manager.nip04Decrypt).not.toHaveBeenCalled();
      host.stop();
    });
  });
});
