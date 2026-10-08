<script lang="ts">
const {
  disabled = false,
  onclick = undefined,
  buttonType = 'button' as 'button' | 'submit' | 'reset',
  title = undefined,
  className = '',
  active = false,
  children,
} = $props();

function handleClick() {
  if (!disabled && onclick) {
    onclick();
  }
}
</script>

<button
  type={buttonType as "button" | "submit" | "reset"}
  {disabled}
  {title}
  class={`btn btn-tab ${className}`}
  class:active
  onclick={handleClick}
>
  {@render children?.()}
</button>

<style>
  /* セグメントコントロールの 1 セグメント。アクティブは一段浮いた面 + 影で示す。 */
  .btn {
    padding: 9px 16px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--color-text-secondary);
    transition:
      background-color 0.2s ease,
      color 0.2s ease,
      box-shadow 0.2s ease;
    font-family: inherit;
    font-weight: 500;
  }

  .btn:focus {
    outline: none;
  }

  .btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-button-primary);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Tab Button */
  .btn-tab.active {
    background-color: var(--color-elevated);
    color: var(--color-titles);
    font-weight: 600;
    box-shadow:
      0 1px 2px var(--color-shadow-strong),
      0 0 0 1px var(--color-border);
  }

  .btn-tab:hover:not(:disabled):not(.active) {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }
</style>
