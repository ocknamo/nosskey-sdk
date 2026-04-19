<script lang="ts">
import { i18n } from '../i18n/i18n-store.js';
import { approveConsent, pendingConsent, rejectConsent } from '../iframe-mode.js';
import Button from './ui/button/Button.svelte';

const CONTENT_PREVIEW_LIMIT = 240;

function truncate(value: string, limit = CONTENT_PREVIEW_LIMIT): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}…`;
}
</script>

{#if $pendingConsent}
  <div class="consent-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-title">
    <div class="consent-card">
      <h2 id="consent-title">{$i18n.t.consent.title}</h2>
      <p class="consent-origin">
        <span class="label">{$i18n.t.consent.origin}</span>
        <code>{$pendingConsent.origin}</code>
      </p>

      {#if $pendingConsent.event}
        <dl class="consent-event">
          <dt>{$i18n.t.consent.eventKind}</dt>
          <dd>{$pendingConsent.event.kind}</dd>
          <dt>{$i18n.t.consent.eventContent}</dt>
          <dd><pre>{truncate($pendingConsent.event.content ?? '')}</pre></dd>
          <dt>{$i18n.t.consent.eventTags}</dt>
          <dd>
            {#if $pendingConsent.event.tags && $pendingConsent.event.tags.length > 0}
              <ul>
                {#each $pendingConsent.event.tags as tag, i (i)}
                  <li><code>{JSON.stringify(tag)}</code></li>
                {/each}
              </ul>
            {:else}
              <span class="muted">{$i18n.t.consent.noTags}</span>
            {/if}
          </dd>
        </dl>
      {/if}

      <div class="consent-actions">
        <Button variant="danger" onclick={rejectConsent}>
          {$i18n.t.consent.reject}
        </Button>
        <Button variant="primary" onclick={approveConsent}>
          {$i18n.t.consent.approve}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .consent-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 1000;
  }

  .consent-card {
    background: var(--color-card);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 8px 24px var(--color-shadow-strong);
    padding: 20px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow: auto;
  }

  h2 {
    margin: 0 0 12px;
    color: var(--color-titles);
  }

  .consent-origin .label {
    font-weight: 600;
    margin-right: 8px;
  }

  code,
  pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9rem;
  }

  pre {
    white-space: pre-wrap;
    word-break: break-word;
    margin: 4px 0;
  }

  .consent-event {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 12px;
    margin: 12px 0 20px;
  }

  .consent-event dt {
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .consent-event dd {
    margin: 0;
  }

  .consent-event ul {
    margin: 0;
    padding-left: 18px;
  }

  .muted {
    color: var(--color-text-muted);
  }

  .consent-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .consent-actions :global(.btn) {
    width: auto;
  }

  /* Embedded mode: parent modal already provides the backdrop and card frame,
     so suppress this component's own dim overlay and let the card fill the
     iframe viewport seamlessly. */
  :global(body.nosskey-embedded) .consent-backdrop {
    background: transparent;
    padding: 0;
  }

  :global(body.nosskey-embedded) .consent-card {
    max-width: none;
    max-height: none;
    height: 100%;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
</style>
