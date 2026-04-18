<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { startIframeHost } from '../../iframe-mode.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import ConsentDialog from '../ConsentDialog.svelte';

type UiState = 'running' | 'partitioned' | 'denied' | 'granted' | 'noKeyExists' | 'unsupported';

interface StorageAccessDocument extends Document {
  requestStorageAccess?: (options?: { all?: boolean }) => Promise<void>;
  hasStorageAccess?: () => Promise<boolean>;
}

let stopHost: (() => void) | null = null;
let state = $state<UiState>('running');
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
    state = 'running';
    return;
  }
  const doc = document as StorageAccessDocument;
  if (typeof doc.requestStorageAccess !== 'function') {
    state = 'unsupported';
    postVisibility(true);
    return;
  }
  try {
    const hasSA = typeof doc.hasStorageAccess === 'function' ? await doc.hasStorageAccess() : false;
    if (hasSA) {
      state = 'noKeyExists';
      postVisibility(true);
      return;
    }
  } catch {
    // Treat hasStorageAccess failures as "not granted" and proceed to request.
  }
  state = 'partitioned';
  postVisibility(true);
}

async function callRequestStorageAccess(doc: StorageAccessDocument): Promise<void> {
  const fn = doc.requestStorageAccess;
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
  const doc = document as StorageAccessDocument;
  working = true;
  errorMessage = '';
  try {
    await callRequestStorageAccess(doc);
    const manager = getNosskeyManager();
    if (manager.hasKeyInfo()) {
      state = 'granted';
      postVisibility(false);
    } else {
      state = 'noKeyExists';
    }
  } catch (err) {
    state = 'denied';
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    working = false;
  }
}

onMount(() => {
  stopHost = startIframeHost();
  void detectInitialState();
});

onDestroy(() => {
  stopHost?.();
  stopHost = null;
});
</script>

<div class="iframe-host">
  <p class="status">{$i18n.t.iframeHost.running}</p>
  {#if state === 'partitioned'}
    <p class="warning">{$i18n.t.iframeHost.partitionedWarning}</p>
    <button type="button" onclick={requestAccess} disabled={working}>
      {$i18n.t.iframeHost.grantStorageAccess}
    </button>
  {:else if state === 'denied'}
    <p class="warning">{$i18n.t.iframeHost.storageAccessDenied}</p>
    {#if errorMessage}
      <p class="error-detail">{errorMessage}</p>
    {/if}
    <button type="button" onclick={requestAccess} disabled={working}>
      {$i18n.t.iframeHost.retry}
    </button>
  {:else if state === 'granted'}
    <p class="success">{$i18n.t.iframeHost.storageAccessGranted}</p>
  {:else if state === 'noKeyExists'}
    <p class="warning">{$i18n.t.iframeHost.noKey}</p>
  {:else if state === 'unsupported'}
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
