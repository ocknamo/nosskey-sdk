<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { isEmbeddedIframeMode, pendingConsent, startIframeHost } from '../../iframe-mode.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
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
  // MUST run before any hasKeyInfo() shortcut — Chromium keeps
  // window.localStorage partitioned even after the grant, so applyStorageGrant()
  // must thread handle.localStorage into the SDK or first-party state
  // (e.g. relays saved via the top-level Settings UI) stays invisible.
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
  }
  if (manager.hasKeyInfo()) {
    uiState = 'granted';
  } else {
    uiState = 'noKeyExists';
  }
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
      };
    case 'unsupported':
      return {
        title: t.unsupportedTitle,
        description: `${t.storageAccessUnsupported} ${t.noKey}`,
        icon: 'info',
        tone: 'warning',
      };
  }
}

onMount(() => {
  if (isEmbeddedIframeMode()) {
    document.body.classList.add('nosskey-embedded');
  }
  stopHost = startIframeHost();
  void detectInitialState();
});

onDestroy(() => {
  document.body.classList.remove('nosskey-embedded');
  stopHost?.();
  stopHost = null;
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
