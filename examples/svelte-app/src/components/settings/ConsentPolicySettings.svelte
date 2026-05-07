<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { type ConsentDecision, type ConsentPolicy, consentPolicy } from '../../store/app-state.js';
import CardSection from '../ui/CardSection.svelte';

const METHOD_KEYS = [
  'signEvent',
  'nip44',
  'nip04',
] as const satisfies readonly (keyof ConsentPolicy)[];
const OPTIONS: ConsentDecision[] = ['ask', 'always', 'deny'];

function setDecision(method: keyof ConsentPolicy, value: ConsentDecision) {
  consentPolicy.update((current) => ({ ...current, [method]: value }));
}

function methodLabel(method: keyof ConsentPolicy): string {
  return $i18n.t.settings.consentPolicy.methodLabel[method];
}

function optionLabel(option: ConsentDecision): string {
  return $i18n.t.settings.consentPolicy.option[option];
}
</script>

<CardSection title={$i18n.t.settings.consentPolicy.title}>
  <p class="description">{$i18n.t.settings.consentPolicy.description}</p>

  <div class="policy-grid">
    {#each METHOD_KEYS as method (method)}
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
      </fieldset>
    {/each}
  </div>
</CardSection>

<style>
  .description {
    margin-bottom: 15px;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
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
</style>
