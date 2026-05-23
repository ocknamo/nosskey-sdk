<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { isEmbeddedIframeMode, pendingConsent, startIframeHost } from '../../iframe-mode.js';
import { getCookieStorage, getNosskeyManager } from '../../services/nosskey-manager.service.js';
import { reloadSettings } from '../../store/app-state.js';
import { buildScreenUrl } from '../../utils/app-navigation.js';
import ConsentDialog from '../ConsentDialog.svelte';
import Button from '../ui/button/Button.svelte';

type UiState = 'running' | 'partitioned' | 'denied' | 'granted' | 'noKeyExists' | 'unsupported';
type IconTone = 'warning' | 'error' | 'success';
type ActionVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning';

// Newer Storage Access API options (`{ all: true }`) are not in the default
// lib.dom yet. Define the call signature locally rather than augmenting
// Document, which would conflict with the existing zero-arg declaration.
// Minimal handle shape — the SDK stores key info in localStorage only, so other
// members (sessionStorage / indexedDB / caches / etc.) are intentionally omitted.
type StorageAccessHandle = {
  localStorage: Storage;
};
type RequestStorageAccessFn = (options?: { all?: boolean }) => Promise<
  StorageAccessHandle | undefined
>;

let stopHost: (() => void) | null = null;
let uiState: UiState = $state('running');
let errorMessage = $state('');
let working = $state(false);

function postVisibility(visible: boolean): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'nosskey:visibility', visible }, '*');
  }
}

async function detectInitialState(): Promise<void> {
  const manager = getNosskeyManager();
  if (typeof document.requestStorageAccess !== 'function') {
    // No Storage Access API: partitioned localStorage is all we can see.
    if (manager.hasKeyInfo()) {
      uiState = 'running';
      return;
    }
    uiState = 'unsupported';
    postVisibility(true);
    return;
  }
  // Try silently first: browsers that remember a prior grant for this
  // top-level × iframe origin pair resolve without a user gesture, so a
  // returning user skips the dialog. First visits and expired grants reject
  // with NotAllowedError, and we fall back to the manual button.
  //
  // Do NOT short-circuit on hasKeyInfo() above this point — see
  // applyStorageGrant() for why the SAA call must run first.
  let handle: StorageAccessHandle | null;
  try {
    handle = await callRequestStorageAccess();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      // No silent grant. Fall back to partitioned key info if available so the
      // user can still sign with their cached key; first-party data (relays,
      // etc.) stays unreachable until they explicitly grant access.
      if (manager.hasKeyInfo()) {
        uiState = 'running';
        return;
      }
      uiState = 'partitioned';
      postVisibility(true);
      return;
    }
    throw err;
  }
  applyStorageGrant(handle);
  if (uiState === 'noKeyExists') {
    postVisibility(true);
  }
}

function isStorageAccessHandle(value: unknown): value is StorageAccessHandle {
  return (
    !!value &&
    typeof value === 'object' &&
    'localStorage' in value &&
    typeof (value as { localStorage: unknown }).localStorage === 'object'
  );
}

// Returns the StorageAccessHandle on Chromium (unpartitioned storage reference),
// or null when the browser auto-unpartitions window.localStorage (Firefox) or
// when we fall back to the zero-arg form.
async function callRequestStorageAccess(): Promise<StorageAccessHandle | null> {
  const fn = document.requestStorageAccess as RequestStorageAccessFn | undefined;
  if (typeof fn !== 'function') {
    throw new Error('Storage Access API is not available.');
  }
  try {
    const result = await fn.call(document, { all: true });
    return isStorageAccessHandle(result) ? result : null;
  } catch (err) {
    // Older implementations reject the `{ all: true }` argument with a
    // TypeError. Fall back to the zero-arg form which at least grants cookie
    // access; Firefox's zero-arg form also unpartitions localStorage.
    if (err instanceof TypeError) {
      await fn.call(document);
      return null;
    }
    throw err;
  }
}

function applyStorageGrant(handle: StorageAccessHandle | null): void {
  const manager = getNosskeyManager();
  if (handle) {
    // Chrome: window.localStorage remains partitioned after the grant —
    // only handle.localStorage points at unpartitioned storage. Thread it
    // into the SDK singleton so both this screen and the NosskeyIframeHost
    // (which shares the same manager) read the unpartitioned store.
    manager.setStorageOptions({ storage: handle.localStorage });
  } else if (isLikelyWebKit()) {
    // Safari/iOS (and any other WebKit-based iOS browser — see
    // isLikelyWebKit comment): SAA grant unpartitions cookies but NOT
    // localStorage. The standalone tab mirrors NostrKeyInfo into a
    // first-party cookie via MultiStorage; switch the manager to read from
    // that CookieStorage so we can rehydrate the key after a parent reload.
    // setStorageOptions drops the in-memory cache when storage reference
    // changes, so the next hasKeyInfo() reads fresh from cookies.
    manager.setStorageOptions({ storage: getCookieStorage() });
  }
  // The SDK manager now points at first-party storage (the SAA handle on
  // Chromium; on Firefox the grant un-partitions window.localStorage and the
  // manager keeps no handle; on Safari the CookieStorage swap above). Reload
  // app settings so consent policy, trusted origins and cache options resolve
  // through that same storage — the one the relay sync already reads via
  // manager.getStorageOptions().storage.
  reloadSettings();
  if (manager.hasKeyInfo()) {
    uiState = 'granted';
  } else {
    uiState = 'noKeyExists';
  }
}

// iOS / iPadOS では Apple のポリシーで全ブラウザが WebKit を使うため、
// CriOS (iOS Chrome) / FxiOS (iOS Firefox) / EdgiOS (iOS Edge) すべて
// Safari と同じ Storage Access API の制約（cookie のみ unpartition、
// localStorage は partition のまま）を受ける。よって関数名は「Safari」
// 限定ではなく「WebKit」とし、cookie 経路フォールバックの対象に含める。
function isLikelyWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // デスクトップ Chromium / Android Chrome / デスクトップ Edge は UA に
  // "Safari" を含むが本来の WebKit ではないので除外する。
  return /Safari/.test(ua) && !/Chrome|Chromium|Android|Edg\//.test(ua);
}

async function requestAccess(): Promise<void> {
  working = true;
  errorMessage = '';
  try {
    const handle = await callRequestStorageAccess();
    applyStorageGrant(handle);
  } catch (err) {
    uiState = 'denied';
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    working = false;
  }
}

function handleClose(): void {
  postVisibility(false);
}

// Open the standalone app's account screen in a new tab so the user can
// register or sign in with a passkey. A new tab is required: this screen
// runs inside the (often cross-origin) signing iframe, where in-place
// navigation would not reach the first-party setup flow.
//
// `noopener` is intentional: the registration tab does NOT need a
// `window.opener` reference back to this iframe. The first-party cookie
// written by `MultiStorage` in the setup tab is what carries the
// NostrKeyInfo across, and `handleVisibilityRecheck` picks it up on
// return. Keep the `noopener` flag — removing it (e.g. for a postMessage
// handoff) is unnecessary and would weaken the security default.
function openSetup(): void {
  window.open(buildScreenUrl(window.location, 'account'), '_blank', 'noopener');
}

// Re-run the SAA / hasKeyInfo gate when the iframe becomes visible again
// after the user returns from the standalone setup tab. On Safari/iOS this
// is what bridges the first-party cookie write done by the standalone tab
// into the iframe's view: silent SAA grant resolves (Safari remembers a
// prior grant), applyStorageGrant swaps the manager to CookieStorage, and
// hasKeyInfo() reads the freshly written NostrKeyInfo. On Chromium/Firefox
// it just reruns the existing happy-path detection.
//
// Skip when we're already in a healthy state: visibilitychange and pageshow
// can fire close together (e.g. BFCache restore), and Safari has been seen
// to throttle / error on rapid back-to-back silent SAA calls.
function handleVisibilityRecheck(): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState !== 'visible') return;
  if (uiState === 'running' || uiState === 'granted') return;
  void detectInitialState();
}

type CardConfig = {
  title: string;
  description: string;
  icon: string;
  tone: IconTone;
  action?: {
    label: string;
    variant: ActionVariant;
    onclick: () => void;
  };
  secondaryLink?: {
    label: string;
    onclick: () => void;
  };
};

function cardForState(state: Exclude<UiState, 'running'>): CardConfig {
  const t = $i18n.t.iframeHost;
  switch (state) {
    case 'partitioned':
      return {
        title: t.partitionedTitle,
        description: t.partitionedWarning,
        icon: 'lock',
        tone: 'warning',
        action: {
          label: t.grantStorageAccess,
          variant: 'warning',
          onclick: () => void requestAccess(),
        },
        secondaryLink: { label: t.openSetup, onclick: openSetup },
      };
    case 'denied':
      return {
        title: t.deniedTitle,
        description: t.storageAccessDenied,
        icon: 'block',
        tone: 'error',
        action: {
          label: t.retry,
          variant: 'danger',
          onclick: () => void requestAccess(),
        },
        secondaryLink: { label: t.openSetup, onclick: openSetup },
      };
    case 'granted':
      return {
        title: t.grantedTitle,
        description: t.storageAccessGranted,
        icon: 'check_circle',
        tone: 'success',
      };
    case 'noKeyExists':
      return {
        title: t.noKeyTitle,
        description: t.noKey,
        icon: 'key_off',
        tone: 'warning',
        action: {
          label: t.openSetup,
          variant: 'primary',
          onclick: openSetup,
        },
      };
    case 'unsupported':
      return {
        title: t.unsupportedTitle,
        description: `${t.storageAccessUnsupported} ${t.noKey}`,
        icon: 'info',
        tone: 'warning',
        action: {
          label: t.openSetup,
          variant: 'primary',
          onclick: openSetup,
        },
      };
  }
}

onMount(() => {
  if (isEmbeddedIframeMode()) {
    document.body.classList.add('nosskey-embedded');
  }
  stopHost = startIframeHost();
  document.addEventListener('visibilitychange', handleVisibilityRecheck);
  window.addEventListener('pageshow', handleVisibilityRecheck);
  void detectInitialState();
});

onDestroy(() => {
  document.body.classList.remove('nosskey-embedded');
  stopHost?.();
  stopHost = null;
  document.removeEventListener('visibilitychange', handleVisibilityRecheck);
  window.removeEventListener('pageshow', handleVisibilityRecheck);
});
</script>

{#if uiState !== 'running' && !$pendingConsent}
  {@const card = cardForState(uiState)}
  <div class="iframe-host" role="dialog" aria-modal="true" aria-labelledby="iframe-host-title">
    <div class="card">
      <button
        type="button"
        class="close-btn"
        aria-label={$i18n.t.common.close}
        onclick={handleClose}
      >
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>

      <span
        class="material-symbols-outlined card-icon tone-{card.tone}"
        aria-hidden="true"
      >
        {card.icon}
      </span>

      <h2 id="iframe-host-title" class="card-title tone-{card.tone}">{card.title}</h2>
      <p class="card-description">{card.description}</p>

      {#if uiState === 'denied' && errorMessage}
        <p class="error-detail">{errorMessage}</p>
      {/if}

      {#if card.action}
        <div class="card-action">
          <Button
            variant={card.action.variant}
            disabled={working}
            onclick={card.action.onclick}
          >
            {card.action.label}
          </Button>
        </div>
      {/if}

      {#if card.secondaryLink}
        <div class="card-setup-link">
          <button
            type="button"
            class="setup-link"
            onclick={card.secondaryLink.onclick}
          >
            {card.secondaryLink.label}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<ConsentDialog />

<style>
  .iframe-host {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 360px;
    background: var(--color-card);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 8px 24px var(--color-shadow-strong);
    padding: 32px 20px 24px;
    text-align: center;
    box-sizing: border-box;
  }

  .close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .close-btn:hover {
    background: var(--color-hover-overlay, rgba(127, 127, 127, 0.15));
  }

  .close-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
  }

  .close-btn .material-symbols-outlined {
    font-size: 22px;
  }

  .card-icon {
    font-size: 56px;
    line-height: 1;
    display: inline-block;
    margin-bottom: 12px;
  }

  .tone-success {
    color: var(--color-success);
  }

  .tone-warning {
    color: var(--color-warning);
  }

  .tone-error {
    color: var(--color-error);
  }

  .card-title {
    margin: 0 0 8px;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .card-description {
    margin: 0 0 16px;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text-secondary);
    word-break: break-word;
  }

  .error-detail {
    margin: 0 0 16px;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    word-break: break-word;
  }

  .card-action {
    display: flex;
    justify-content: center;
    margin-top: 8px;
  }

  .card-action :global(.btn) {
    width: auto;
    min-width: 160px;
  }

  .card-setup-link {
    display: flex;
    justify-content: center;
    margin-top: 12px;
  }

  .setup-link {
    background: none;
    border: none;
    padding: 4px 8px;
    font-size: 0.8rem;
    color: var(--color-primary);
    cursor: pointer;
    text-decoration: underline;
  }

  .setup-link:hover {
    color: var(--color-button-primary-hover);
  }

  .setup-link:focus-visible {
    outline: none;
    border-radius: 4px;
    box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
  }

  /* Mobile-first: tighter spacing on narrow viewports */
  @media (max-width: 360px) {
    .card {
      padding: 28px 14px 20px;
    }

    .card-icon {
      font-size: 48px;
    }

    .card-title {
      font-size: 1rem;
    }
  }

  /* Embedded mode: parent modal already provides the backdrop and card frame,
     so suppress this component's own dim overlay and let the card fill the
     iframe viewport seamlessly. */
  :global(body.nosskey-embedded) .iframe-host {
    background: transparent;
    padding: 12px;
  }

  :global(body.nosskey-embedded) .card {
    max-width: none;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
