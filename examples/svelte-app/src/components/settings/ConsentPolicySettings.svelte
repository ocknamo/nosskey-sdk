<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import {
  type ConsentDecision,
  type ConsentPolicy,
  POLICY_KEYS,
  type PolicyKey,
  consentPolicy,
  denyCounts,
  resetDenyCounts,
  storageCorruption,
} from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';
import Button from '../ui/button/Button.svelte';

const OPTIONS: ConsentDecision[] = ['ask', 'always', 'deny'];

let savedMessage = $state('');

function setDecision(method: keyof ConsentPolicy, value: ConsentDecision) {
  consentPolicy.update((current) => ({ ...current, [method]: value }));
  savedMessage = $i18n.t.settings.consentPolicy.saved;
  setTimeout(() => {
    savedMessage = '';
  }, 2000);
}

function methodLabel(method: PolicyKey): string {
  return $i18n.t.settings.consentPolicy.methodLabel[method];
}

function optionLabel(option: ConsentDecision): string {
  return $i18n.t.settings.consentPolicy.option[option];
}
</script>

<CardSection title={$i18n.t.settings.consentPolicy.title}>
  <p class="description">{$i18n.t.settings.consentPolicy.description}</p>

  {#if $storageCorruption.consentPolicy || $storageCorruption.trustedOrigins}
    <p class="corruption-warning" role="alert">
      {$i18n.t.settings.consentPolicy.corruptionWarning}
    </p>
  {/if}

  <div class="policy-grid">
    {#each POLICY_KEYS as method (method)}
      <fieldset class="policy-row">
        <legend>{methodLabel(method)}</legend>
        <div class="radio-group">
          {#each OPTIONS as option (option)}
            <label>
              <input
                type="radio"
                name="consent-policy-{method}"
                value={option}
                checked={$consentPolicy[method] === option}
                onchange={() => setDecision(method, option)}
              />
              {optionLabel(option)}
            </label>
          {/each}
        </div>
        {#if $denyCounts[method] > 0}
          <p class="deny-count" aria-live="polite">
            {@html $i18n.t.settings.consentPolicy.denyCount.replace(
              '{count}',
              `<strong>${$denyCounts[method]}</strong>`
            )}
          </p>
        {/if}
      </fieldset>
    {/each}
  </div>

  {#if $denyCounts.signEvent > 0 || $denyCounts.nip44 > 0 || $denyCounts.nip04 > 0}
    <div class="deny-actions">
      <Button variant="secondary" size="small" onclick={resetDenyCounts}>
        {$i18n.t.settings.consentPolicy.resetDenyCounts}
      </Button>
    </div>
  {/if}

  {#if savedMessage}
    <div class="saved-message" aria-live="polite">{savedMessage}</div>
  {/if}
</CardSection>

<style>
  .description {
    margin-bottom: 15px;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  .corruption-warning {
    margin: 0 0 12px;
    padding: 10px 12px;
    border-radius: 8px;
    background-color: var(--color-warning-bg, #fff7e0);
    border: 1px solid var(--color-warning-border, #e6c452);
    color: var(--color-warning, #8a6d00);
    font-size: 0.9rem;
  }

  .policy-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .policy-row {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 8px 12px;
    margin: 0;
  }

  .policy-row legend {
    padding: 0 6px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 4px;
  }

  .radio-group label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .radio-group input[type='radio'] {
    margin: 0;
  }

  .deny-count {
    margin: 6px 0 0;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .deny-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
  }

  .saved-message {
    margin-top: 12px;
    padding: 8px 12px;
    background-color: var(--color-success-bg);
    border: 1px solid var(--color-success-border);
    border-radius: 8px;
    color: var(--color-success);
    font-size: 0.9rem;
  }
</style>
