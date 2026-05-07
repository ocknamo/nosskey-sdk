import type { ConsentRequest, NosskeyIframeHostOptions } from 'nosskey-iframe';
import { NosskeyIframeHost } from 'nosskey-iframe';
import { get, writable } from 'svelte/store';
import { getNosskeyManager } from './services/nosskey-manager.service.js';
import { loadRelays } from './services/relays-store.js';
import { consentPolicy, trustedOrigins } from './store/app-state.js';
import { evaluateConsent, policyKeyFor } from './utils/consent-gating.js';

export interface ApproveOptions {
  /** チェックボックス「このサイトを常に許可」が ON のときに渡される。 */
  trustOrigin?: boolean;
}

export interface PendingConsent extends ConsentRequest {
  resolve: (approved: boolean, options?: ApproveOptions) => void;
}

export const pendingConsent = writable<PendingConsent | null>(null);

/**
 * `trustOrigin` が ON のとき、リクエストの origin × method 単位で信頼リストに追加する。
 * すべてのメソッドを許可するのではなく、現在のリクエスト method（policyKey 単位）のみを許可する点に注意。
 */
function rememberOriginIfRequested(
  request: ConsentRequest,
  options: ApproveOptions | undefined
): void {
  if (!options?.trustOrigin) return;
  const key = policyKeyFor(request.method);
  trustedOrigins.update((list) => {
    const existing = list.find((entry) => entry.origin === request.origin);
    if (!existing) return [...list, { origin: request.origin, methods: [key] }];
    if (existing.methods.includes(key)) return list;
    return list.map((entry) =>
      entry.origin === request.origin ? { ...entry, methods: [...entry.methods, key] } : entry
    );
  });
}

function onConsent(request: ConsentRequest): Promise<boolean> {
  const evaluation = evaluateConsent(request, {
    trustedOrigins: get(trustedOrigins),
    policy: get(consentPolicy),
  });
  if (evaluation.decision === 'approve') return Promise.resolve(true);
  if (evaluation.decision === 'reject') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    pendingConsent.set({
      ...request,
      resolve: (approved, options) => {
        if (approved) rememberOriginIfRequested(request, options);
        resolve(approved);
      },
    });
  });
}

export function approveConsent(options?: ApproveOptions): void {
  pendingConsent.update((current) => {
    current?.resolve(true, options);
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
  const manager = getNosskeyManager();
  const host = new NosskeyIframeHost({
    manager,
    // NOTE: 'allowedOrigins: *' は postMessage の入口を全許可するデバッグ用設定。
    // 「信頼済みオリジン」機能はあくまでダイアログを抑制するレイヤーであり、
    // ここで原点フィルタを行うものではない。プロダクション統合時は親オリジンを限定すること。
    allowedOrigins: '*',
    requireUserConsent: true,
    onConsent,
    // Read through the SDK's storage handle so we hit first-party storage
    // when the user has granted access (Chromium keeps window.localStorage
    // partitioned even after the grant — only the handle points at it).
    onGetRelays: async () => loadRelays(manager.getStorageOptions().storage),
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
