import type { ConsentRequest, NosskeyIframeHostOptions } from 'nosskey-iframe';
import { NosskeyIframeHost } from 'nosskey-iframe';
import { writable } from 'svelte/store';
import { getNosskeyManager } from './services/nosskey-manager.service.js';

export interface PendingConsent extends ConsentRequest {
  resolve: (approved: boolean) => void;
}

export const pendingConsent = writable<PendingConsent | null>(null);

function onConsent(request: ConsentRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    pendingConsent.set({ ...request, resolve });
  });
}

export function approveConsent(): void {
  pendingConsent.update((current) => {
    current?.resolve(true);
    return null;
  });
}

export function rejectConsent(): void {
  pendingConsent.update((current) => {
    current?.resolve(false);
    return null;
  });
}

export function isEmbeddedIframeMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('embedded') === '1';
}

export function startIframeHost(overrides: Partial<NosskeyIframeHostOptions> = {}): () => void {
  const host = new NosskeyIframeHost({
    manager: getNosskeyManager(),
    allowedOrigins: '*',
    requireUserConsent: true,
    onConsent,
    ...overrides,
  });
  host.start();
  return () => {
    host.stop();
    pendingConsent.update((current) => {
      current?.resolve(false);
      return null;
    });
  };
}
