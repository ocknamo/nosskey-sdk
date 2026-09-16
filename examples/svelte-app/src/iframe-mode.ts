import type { ConsentRequest, NosskeyIframeHostOptions } from 'nosskey-iframe';
import { isDecryptMethod, NosskeyIframeHost } from 'nosskey-iframe';
import { get, writable } from 'svelte/store';
import { getNosskeyManager } from './services/nosskey-manager.service.js';
import { loadRelays } from './services/relays-store.js';
import {
  consentPolicy,
  incrementDenyCount,
  reloadSettings,
  trustedOrigins,
} from './store/app-state.js';
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
 * 表示待ちの同意要求。`pendingConsent` は常にこの先頭を指す。
 *
 * ストアに直接 set していた頃は、2 件目が届くと 1 件目の `resolve` ごと上書きされ、
 * 先行リクエストが永久に解決されなかった（host 側は `await onConsent` のまま
 * `finally` に到達せず、iframe も表示されたまま残る）。ストレージ回復待ちの導入で
 * 「保留していた複数リクエストが一斉に解放される」経路ができ、この取りこぼしが
 * 例外的なケースから通常経路に昇格したため、キューで順次さばく。
 */
let consentQueue: PendingConsent[] = [];

/** 先頭をストアへ反映する。キューが空なら null。 */
function showHeadConsent(): void {
  pendingConsent.set(consentQueue[0] ?? null);
}

/**
 * 先頭の同意要求を決着させ、次があれば表示する。
 * キューが空のときは何もしない（多重クリック対策）。
 */
function settleHeadConsent(approved: boolean, options?: ApproveOptions): void {
  const head = consentQueue.shift();
  showHeadConsent();
  head?.resolve(approved, options);
}

/** テスト用。前のテストが残した保留を持ち越さない。 */
export function resetConsentQueueForTest(): void {
  consentQueue = [];
  pendingConsent.set(null);
}

/** 保留中の同意要求をすべて拒否で決着させる（ホスト停止時など）。 */
function drainConsentQueue(): void {
  const queued = consentQueue;
  consentQueue = [];
  showHeadConsent();
  for (const entry of queued) entry.resolve(false);
}

/**
 * `trustOrigin` が ON のとき、リクエストの origin × method 単位で信頼リストに追加する。
 * すべてのメソッドを許可するのではなく、現在のリクエスト method（policyKey 単位）のみを許可する点に注意。
 *
 * 復号系メソッドは「常に許可」の対象外（security audit M-1）。ダイアログ側でも
 * 「常に許可」を提示しないため通常 `trustOrigin` は立たないが、多層防御として
 * ここでも記憶をスキップする（復号を信頼リストに載せても `evaluateConsent` が
 * サイレント承認しないため無意味かつ誤解を招くエントリになる）。
 */
function rememberOriginIfRequested(
  request: ConsentRequest,
  options: ApproveOptions | undefined
): void {
  if (!options?.trustOrigin) return;
  if (isDecryptMethod(request.method)) return;
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

/**
 * `NosskeyIframeHost.onConsent` 実装。テスト容易性のため export する。
 * - ストアから現在のポリシー / 信頼リストを読み、純粋判定 (`evaluateConsent`) に委譲
 * - `deny` 経路では warn＋カウンタ加算
 * - `ask` 経路では `pendingConsent` をセットしてユーザー操作を待つ。承認時に
 *   `trustOrigin` オプションが立っていれば origin × method を信頼リストに追加
 */
export function onConsent(request: ConsentRequest): Promise<boolean> {
  const evaluation = evaluateConsent(request, {
    trustedOrigins: get(trustedOrigins),
    policy: get(consentPolicy),
  });
  if (evaluation.decision === 'approve') return Promise.resolve(true);
  if (evaluation.decision === 'reject') {
    // deny ポリシーは黙って拒否すると、悪意ある親からのプローブ
    // (e.g. 任意 pubkey に対する nip04_decrypt 要求) をユーザーに知られず
    // 試され続ける可能性がある。最低限 warn＋カウンタで観測できるようにする。
    const key = policyKeyFor(request.method);
    console.warn(
      `[nosskey] consent auto-rejected for ${request.method} from ${request.origin} (policy=deny)`
    );
    incrementDenyCount(key);
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    consentQueue.push({
      ...request,
      resolve: (approved, options) => {
        if (approved) rememberOriginIfRequested(request, options);
        resolve(approved);
      },
    });
    showHeadConsent();
  });
}

/**
 * `NosskeyIframeHost` に渡す `onConsent` 実装。判定の直前に永続化設定を読み直す。
 * 設定画面タブで「拒否 / 信頼解除」されても storage イベントが cross-site iframe に
 * 届くとは限らないため、署名リクエストごとにストレージから直接読み直して
 * `onConsent`（純粋判定）に渡し、設定変更を確実に反映する。
 */
export function onConsentWithFreshSettings(request: ConsentRequest): Promise<boolean> {
  reloadSettings();
  return onConsent(request);
}

export function approveConsent(options?: ApproveOptions): void {
  settleHeadConsent(true, options);
}

export function rejectConsent(): void {
  settleHeadConsent(false);
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
    onConsent: onConsentWithFreshSettings,
    // Read through the SDK's storage handle so we hit first-party storage
    // when the user has granted access (Chromium keeps window.localStorage
    // partitioned even after the grant — only the handle points at it).
    onGetRelays: async () => loadRelays(manager.getStorageOptions().storage),
    ...overrides,
  });
  host.start();
  return () => {
    host.stop();
    // 保留を残すと、親のリクエストがタイムアウトまで宙吊りになる。
    drainConsentQueue();
  };
}
