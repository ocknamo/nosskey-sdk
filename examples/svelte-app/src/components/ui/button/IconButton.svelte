<script lang="ts">
const {
  disabled = false,
  onclick = undefined,
  buttonType = 'button' as 'button' | 'submit' | 'reset',
  title = undefined,
  className = '',
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
  class={`btn btn-icon ${className}`}
  onclick={handleClick}
>
  {@render children?.()}
</button>

<style>
  .btn {
    border: none;
    border-radius: 4px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    line-height: 1;
    background: none;
  }

  .btn:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-primary-alpha-20);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Icon Button */
  .btn-icon {
    padding: 4px;
    color: var(--color-text);
    background-color: transparent;
  }

  .btn-icon:hover:not(:disabled) {
    background-color: var(--color-border-light);
  }

  .btn-icon:active:not(:disabled) {
    background-color: var(--color-border-medium);
  }

  .btn-icon:disabled {
    background-color: transparent;
  }
</style>
