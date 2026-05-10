<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { isEmbeddedIframeMode, startIframeHost } from '../../iframe-mode.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import ConsentDialog from '../ConsentDialog.svelte';

type UiState = 'running' | 'partitioned' | 'denied' | 'granted' | 'noKeyExists' | 'unsupported';

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
  if (manager.hasKeyInfo()) {
    uiState = 'running';
    return;
  }
  if (typeof document.requestStorageAccess !== 'function') {
    uiState = 'unsupported';
    postVisibility(true);
    return;
  }
  // Try silently first: browsers that remember a prior grant for this
  // top-level × iframe origin pair resolve without a user gesture, so a
  // returning user skips the dialog. First visits and expired grants reject,
  // and we fall back to the manual button.
  try {
    const handle = await callRequestStorageAccess();
    applyStorageGrant(handle);
  } catch {
    uiState = 'partitioned';
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
    postVisibility(false);
  } else {
    uiState = 'noKeyExists';
    postVisibility(true);
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

<div class="iframe-host">
  <p class="status">{$i18n.t.iframeHost.running}</p>
  {#if uiState === 'partitioned'}
    <p class="warning">{$i18n.t.iframeHost.partitionedWarning}</p>
    <button type="button" onclick={requestAccess} disabled={working}>
      {$i18n.t.iframeHost.grantStorageAccess}
    </button>
  {:else if uiState === 'denied'}
    <p class="warning">{$i18n.t.iframeHost.storageAccessDenied}</p>
    {#if errorMessage}
      <p class="error-detail">{errorMessage}</p>
    {/if}
    <button type="button" onclick={requestAccess} disabled={working}>
      {$i18n.t.iframeHost.retry}
    </button>
  {:else if uiState === 'granted'}
    <p class="success">{$i18n.t.iframeHost.storageAccessGranted}</p>
  {:else if uiState === 'noKeyExists'}
    <p class="warning">{$i18n.t.iframeHost.noKey}</p>
  {:else if uiState === 'unsupported'}
    <p class="warning">{$i18n.t.iframeHost.storageAccessUnsupported}</p>
    <p class="warning">{$i18n.t.iframeHost.noKey}</p>
  {/if}
</div>

<ConsentDialog />

<style>
  .iframe-host {
    padding: 16px;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .status {
    margin: 8px 0;
  }

  .warning {
    color: var(--color-warning);
    font-weight: 600;
    margin: 8px 0;
  }

  .success {
    color: var(--color-success);
    font-weight: 600;
    margin: 8px 0;
  }

  .error-detail {
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    margin: 4px 0;
    word-break: break-word;
  }

  button {
    margin-top: 8px;
    padding: 8px 16px;
    border: 1px solid var(--color-warning);
    background-color: transparent;
    color: var(--color-warning);
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
