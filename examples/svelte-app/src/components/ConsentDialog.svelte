<script lang="ts">
import { type NosskeyMethod, isDecryptMethod, isEncryptMethod } from 'nosskey-iframe';
import { i18n } from '../i18n/i18n-store.js';
import { approveConsent, pendingConsent, rejectConsent } from '../iframe-mode.js';
import { hexToNpub } from '../utils/bech32-converter.js';
import { kindLabel } from '../utils/event-kind-labels.js';
import Button from './ui/button/Button.svelte';

const CONTENT_PREVIEW_LIMIT = 100;
const NPUB_HEAD = 8;
const NPUB_TAIL = 8;

// `{#if $pendingConsent}` 配下のため、ダイアログがアンマウント・再マウントされる
// 度に false で再初期化される。承認/拒否後の明示リセットも併せて行うのは、
// 同じインスタンスのまま次の request が即セットされる稀なケースでの保険。
let trustOrigin = $state(false);

function truncate(value: string, limit = CONTENT_PREVIEW_LIMIT): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}…`;
}

/**
 * Render a 64-char hex pubkey as a shortened npub. We prefer npub over hex
 * here because consent dialogs are user-facing and Nostr clients
 * conventionally show npub. Fall back to a hex truncation if conversion
 * fails (malformed pubkey from the parent).
 */
function renderPeerPubkey(hexPubkey: string): string {
  try {
    const npub = hexToNpub(hexPubkey);
    if (npub.length <= NPUB_HEAD + NPUB_TAIL + 1) return npub;
    return `${npub.slice(0, NPUB_HEAD)}…${npub.slice(-NPUB_TAIL)}`;
  } catch {
    return hexPubkey.length > 16 ? `${hexPubkey.slice(0, 8)}…${hexPubkey.slice(-8)}` : hexPubkey;
  }
}

function methodLabel(method: NosskeyMethod, labels: typeof $i18n.t.consent.methodLabel): string {
  switch (method) {
    case 'signEvent':
      return labels.signEvent;
    case 'nip44_encrypt':
      return labels.nip44Encrypt;
    case 'nip44_decrypt':
      return labels.nip44Decrypt;
    case 'nip04_encrypt':
      return labels.nip04Encrypt;
    case 'nip04_decrypt':
      return labels.nip04Decrypt;
    default:
      return method;
  }
}

function dialogTitle(method: NosskeyMethod, t: typeof $i18n.t.consent): string {
  if (method === 'signEvent') return t.title;
  if (isDecryptMethod(method)) return t.titleDecrypt;
  return t.titleEncrypt;
}

function handleApprove() {
  approveConsent({ trustOrigin });
  trustOrigin = false;
}

function handleReject() {
  rejectConsent();
  trustOrigin = false;
}
</script>

{#if $pendingConsent}
  {@const c = $pendingConsent}
  {@const isEncrypt = isEncryptMethod(c.method)}
  {@const isDecrypt = isDecryptMethod(c.method)}
  <div class="consent-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-title">
    <div class="consent-card">
      <h2 id="consent-title">{dialogTitle(c.method, $i18n.t.consent)}</h2>
      <p class="consent-origin">
        <span class="label">{$i18n.t.consent.origin}</span>
        <code>{c.origin}</code>
      </p>

      <dl class="consent-event">
        <dt>{$i18n.t.consent.method}</dt>
        <dd>{methodLabel(c.method, $i18n.t.consent.methodLabel)}</dd>

        {#if c.event}
          <dt>{$i18n.t.consent.eventKind}</dt>
          <dd>
            {kindLabel(c.event.kind, $i18n.t.consent.kindLabel)}
            <span class="muted">(kind:{c.event.kind})</span>
          </dd>
          <dt>{$i18n.t.consent.eventContent}</dt>
          <dd><pre>{truncate(c.event.content ?? '')}</pre></dd>
          <dt>{$i18n.t.consent.eventTags}</dt>
          <dd>
            {#if c.event.tags && c.event.tags.length > 0}
              <ul>
                {#each c.event.tags as tag, i (i)}
                  <li><code>{JSON.stringify(tag)}</code></li>
                {/each}
              </ul>
            {:else}
              <span class="muted">{$i18n.t.consent.noTags}</span>
            {/if}
          </dd>
        {/if}

        {#if c.pubkey}
          <dt>{$i18n.t.consent.peerPubkey}</dt>
          <dd>
            <code title={c.pubkey}>{renderPeerPubkey(c.pubkey)}</code>
          </dd>
        {/if}

        {#if isEncrypt && c.plaintext !== undefined}
          <dt>{$i18n.t.consent.plaintext}</dt>
          <dd><pre>{truncate(c.plaintext)}</pre></dd>
        {/if}

        {#if isDecrypt}
          <dt>{$i18n.t.consent.plaintext}</dt>
          <dd><span class="muted">{$i18n.t.consent.decryptNoPreview}</span></dd>
        {/if}
      </dl>

      {#if c.event}
        <details class="consent-raw">
          <summary>{$i18n.t.consent.showRaw}</summary>
          <pre>{JSON.stringify(c.event, null, 2)}</pre>
        </details>
      {/if}

      <label class="consent-trust">
        <input type="checkbox" bind:checked={trustOrigin} />
        <span>{$i18n.t.consent.alwaysAllowSite}</span>
      </label>

      <div class="consent-actions">
        <Button variant="danger" onclick={handleReject}>
          {$i18n.t.consent.reject}
        </Button>
        <Button variant="primary" onclick={handleApprove}>
          {trustOrigin ? $i18n.t.consent.approveAndTrust : $i18n.t.consent.approve}
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
    margin: 12px 0 12px;
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

  .consent-raw {
    margin: 0 0 16px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 8px 12px;
  }

  .consent-raw summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .consent-raw pre {
    margin-top: 8px;
    max-height: 240px;
    overflow: auto;
  }

  .consent-trust {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    cursor: pointer;
  }

  .consent-trust input[type='checkbox'] {
    margin: 0;
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
