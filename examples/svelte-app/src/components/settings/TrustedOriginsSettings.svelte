<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { type PolicyKey, trustedOrigins } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';

function removeMethod(origin: string, method: PolicyKey) {
  if (!confirm($i18n.t.settings.trustedOrigins.confirmRemove)) return;
  trustedOrigins.update((list) =>
    list
      .map((entry) =>
        entry.origin === origin
          ? { ...entry, methods: entry.methods.filter((m) => m !== method) }
          : entry
      )
      // すべてのメソッドが外れたエントリは破棄する
      .filter((entry) => entry.methods.length > 0)
  );
}

function removeAll(origin: string) {
  if (!confirm($i18n.t.settings.trustedOrigins.confirmRemoveAll)) return;
  trustedOrigins.update((list) => list.filter((entry) => entry.origin !== origin));
}

function methodLabel(method: PolicyKey): string {
  return $i18n.t.settings.consentPolicy.methodLabel[method];
}
</script>

<CardSection title={$i18n.t.settings.trustedOrigins.title}>
  <p class="description">{$i18n.t.settings.trustedOrigins.description}</p>

  {#if $trustedOrigins.length === 0}
    <p class="empty">{$i18n.t.settings.trustedOrigins.empty}</p>
  {:else}
    <ul class="origin-list">
      {#each $trustedOrigins as entry (entry.origin)}
        <li class="origin-item">
          <div class="origin-header">
            <code class="origin-url" title={entry.origin}>{entry.origin}</code>
            <Button variant="danger" size="small" onclick={() => removeAll(entry.origin)}>
              {$i18n.t.settings.trustedOrigins.removeAllButton}
            </Button>
          </div>
          <ul class="method-list">
            {#each entry.methods as method (method)}
              <li class="method-item">
                <span class="method-label">{methodLabel(method)}</span>
                <Button
                  variant="secondary"
                  size="small"
                  onclick={() => removeMethod(entry.origin, method)}
                >
                  {$i18n.t.settings.trustedOrigins.removeButton}
                </Button>
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
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

  .origin-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .origin-item {
    padding: 10px 12px;
    background-color: var(--color-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .origin-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .origin-url {
    flex: 1 1 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    color: var(--color-text);
  }

  .method-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .method-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 8px;
    border-radius: 6px;
  }

  .method-label {
    flex: 1 1 auto;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }
</style>
