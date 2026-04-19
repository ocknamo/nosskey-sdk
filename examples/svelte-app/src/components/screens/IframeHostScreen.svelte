<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { startIframeHost } from '../../iframe-mode.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import ConsentDialog from '../ConsentDialog.svelte';

type UiState = 'running' | 'partitioned' | 'denied' | 'granted' | 'noKeyExists' | 'unsupported';

// Newer Storage Access API options (`{ all: true }`) are not in the default
// lib.dom yet. Define the call signature locally rather than augmenting
// Document, which would conflict with the existing zero-arg declaration.
type RequestStorageAccessFn = (options?: { all?: boolean }) => Promise<void>;

let stopHost: (() => void) | null = null;
let uiState: UiState = $state('running');
let errorMessage = $state('');
let working = $state(false);

function postVisibility(visible: boolean): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'nosskey:visibility', visible }, '*');
  }
}

function detectInitialState(): void {
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
  // `document.hasStorageAccess()` reflects cookie access only and does not
  // indicate whether localStorage is unpartitioned, so always offer the Grant
  // button when no key is loaded. After the user gesture we re-check the key.
  uiState = 'partitioned';
  postVisibility(true);
}

async function callRequestStorageAccess(): Promise<void> {
  const fn = document.requestStorageAccess as RequestStorageAccessFn | undefined;
  if (typeof fn !== 'function') {
    throw new Error('Storage Access API is not available.');
  }
  try {
    await fn.call(document, { all: true });
  } catch (err) {
    // Older implementations reject the `{ all: true }` argument with a
    // TypeError. Fall back to the zero-arg form which at least grants cookie
    // access; Firefox's zero-arg form also unpartitions localStorage.
    if (err instanceof TypeError) {
      await fn.call(document);
      return;
    }
    throw err;
  }
}

async function requestAccess(): Promise<void> {
  working = true;
  errorMessage = '';
  try {
    await callRequestStorageAccess();
    const manager = getNosskeyManager();
    if (manager.hasKeyInfo()) {
      uiState = 'granted';
      postVisibility(false);
    } else {
      uiState = 'noKeyExists';
    }
  } catch (err) {
    uiState = 'denied';
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    working = false;
  }
}

onMount(() => {
  stopHost = startIframeHost();
  detectInitialState();
});

onDestroy(() => {
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
