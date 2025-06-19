<script lang="ts">
type ButtonSize = 'small' | 'medium' | 'large';

const {
  disabled = false,
  size = 'medium' as ButtonSize,
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
  class={`btn btn-secondary btn-${size} ${className}`}
  onclick={handleClick}
>
  {@render children?.()}
</button>

<style>
  .btn {
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    line-height: 1;
  }

  .btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Secondary Button */
  .btn-secondary {
    background-color: var(--color-button-secondary);
    color: var(--color-text-on-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-button-secondary-hover);
  }

  .btn-secondary:disabled {
    background-color: var(--color-button-disabled);
  }

  /* Sizes */
  .btn-small {
    padding: 6px 12px;
    font-size: 0.875rem;
    border-radius: 6px;
  }

  .btn-medium {
    padding: 10px 20px;
    font-size: 1rem;
  }

  .btn-large {
    padding: 12px 24px;
    font-size: 1.125rem;
  }
</style>
