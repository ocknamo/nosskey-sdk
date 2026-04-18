<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { i18n } from '../../i18n/i18n-store.js';
import { startIframeHost } from '../../iframe-mode.js';
import { getNosskeyManager } from '../../services/nosskey-manager.service.js';
import ConsentDialog from '../ConsentDialog.svelte';

let stopHost: (() => void) | null = null;
let hasKey = $state(false);

onMount(() => {
  hasKey = getNosskeyManager().hasKeyInfo();
  stopHost = startIframeHost();
});

onDestroy(() => {
  stopHost?.();
  stopHost = null;
});
</script>

<div class="iframe-host">
  <p class="status">{$i18n.t.iframeHost.running}</p>
  {#if !hasKey}
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
  }
</style>
