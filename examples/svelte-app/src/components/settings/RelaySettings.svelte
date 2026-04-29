<script lang="ts">
import type { RelayMap } from 'nosskey-iframe';
import { i18n } from '../../i18n/i18n-store.js';
import { loadRelays, saveRelays } from '../../services/relays-store.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';

let relays = $state<RelayMap>(loadRelays());
let newRelayUrl = $state('');
let errorMessage = $state('');

function persist() {
  saveRelays(relays);
}

function isValidRelayUrl(url: string): boolean {
  return /^wss?:\/\/.+/i.test(url.trim());
}

function addRelay() {
  const url = newRelayUrl.trim();
  if (!isValidRelayUrl(url)) {
    errorMessage = $i18n.t.settings.relays.invalidUrl;
    return;
  }
  if (relays[url]) {
    errorMessage = '';
    newRelayUrl = '';
    return;
  }
  relays = { ...relays, [url]: { read: true, write: true } };
  newRelayUrl = '';
  errorMessage = '';
  persist();
}

function removeRelay(url: string) {
  const next = { ...relays };
  delete next[url];
  relays = next;
  persist();
}

function toggleRead(url: string) {
  const entry = relays[url];
  if (!entry) return;
  relays = { ...relays, [url]: { ...entry, read: !entry.read } };
  persist();
}

function toggleWrite(url: string) {
  const entry = relays[url];
  if (!entry) return;
  relays = { ...relays, [url]: { ...entry, write: !entry.write } };
  persist();
}

function relayEntries(map: RelayMap): Array<[string, { read: boolean; write: boolean }]> {
  return Object.entries(map);
}
</script>

<CardSection title={$i18n.t.settings.relays.title}>
  <p class="description">{$i18n.t.settings.relays.description}</p>

  {#if relayEntries(relays).length === 0}
    <p class="empty">{$i18n.t.settings.relays.empty}</p>
  {:else}
    <ul class="relay-list">
      {#each relayEntries(relays) as [url, flags] (url)}
        <li class="relay-item">
          <div class="relay-url" title={url}>{url}</div>
          <label class="flag">
            <input
              type="checkbox"
              checked={flags.read}
              onchange={() => toggleRead(url)}
            />
            {$i18n.t.settings.relays.readLabel}
          </label>
          <label class="flag">
            <input
              type="checkbox"
              checked={flags.write}
              onchange={() => toggleWrite(url)}
            />
            {$i18n.t.settings.relays.writeLabel}
          </label>
          <Button
            variant="danger"
            size="small"
            onclick={() => removeRelay(url)}
          >
            {$i18n.t.settings.relays.removeButton}
          </Button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="add-row">
    <input
      type="url"
      class="add-input"
      placeholder={$i18n.t.settings.relays.addPlaceholder}
      bind:value={newRelayUrl}
    />
    <Button variant="primary" onclick={addRelay}>
      {$i18n.t.settings.relays.addButton}
    </Button>
  </div>

  {#if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {/if}
</CardSection>

<style>
  .description {
    margin-bottom: 15px;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  .empty {
    margin: 10px 0;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .relay-list {
    list-style: none;
    padding: 0;
    margin: 0 0 15px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .relay-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background-color: var(--color-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .relay-url {
    flex: 1 1 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    color: var(--color-text);
  }

  .flag {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text-secondary);
  }

  .add-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
  }

  .add-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background-color: var(--color-card);
    color: var(--color-text);
    font-family: monospace;
  }

  .error-message {
    margin-top: 10px;
    padding: 8px 12px;
    background-color: var(--color-danger-bg, #fee);
    border: 1px solid var(--color-danger-border, #f88);
    border-radius: 8px;
    color: var(--color-danger, #c00);
  }
</style>
