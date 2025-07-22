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
  .btn {
    padding: 8px 16px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--color-text);
    transition:
      background-color 0.3s ease,
      color 0.3s ease;
    font-family: inherit;
    font-weight: 400;
  }

  .btn:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-primary-alpha-20);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Tab Button */
  .btn-tab.active {
    background-color: var(--color-primary);
    color: var(--color-text-on-primary);
    font-weight: bold;
  }

  .btn-tab:hover:not(:disabled):not(.active) {
    background-color: var(--color-surface-hover);
  }
</style>
