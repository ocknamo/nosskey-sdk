<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { trustedOrigins } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';

function removeOrigin(origin: string) {
  trustedOrigins.update((list) => list.filter((entry) => entry !== origin));
}
</script>

<CardSection title={$i18n.t.settings.trustedOrigins.title}>
  <p class="description">{$i18n.t.settings.trustedOrigins.description}</p>

  {#if $trustedOrigins.length === 0}
    <p class="empty">{$i18n.t.settings.trustedOrigins.empty}</p>
  {:else}
    <ul class="origin-list">
      {#each $trustedOrigins as origin (origin)}
        <li class="origin-item">
          <code class="origin-url" title={origin}>{origin}</code>
          <Button variant="danger" size="small" onclick={() => removeOrigin(origin)}>
            {$i18n.t.settings.trustedOrigins.removeButton}
          </Button>
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
    gap: 8px;
  }

  .origin-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background-color: var(--color-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .origin-url {
    flex: 1 1 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    color: var(--color-text);
  }
</style>
