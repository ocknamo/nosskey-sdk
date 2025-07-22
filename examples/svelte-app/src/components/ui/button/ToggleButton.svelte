<script lang="ts">
type ButtonSize = 'small' | 'medium' | 'large';

const {
  disabled = false,
  size = 'medium' as ButtonSize,
  onclick = undefined,
  buttonType = 'button' as 'button' | 'submit' | 'reset',
  title = undefined,
  className = '',
  expanded = false,
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
  class={`btn btn-toggle btn-${size} ${className}`}
  onclick={handleClick}
>
  <span class="toggle-icon" class:expanded>▶</span>
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
    justify-content: flex-start;
    text-decoration: none;
    line-height: 1;
    gap: 8px;
    width: 100%;
    text-align: left;
  }

  .btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Toggle Button */
  .btn-toggle {
    background-color: var(--color-surface-hover);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-medium);
  }

  .btn-toggle:hover:not(:disabled) {
    background-color: var(--color-surface-light);
  }

  .btn-toggle.small {
    color: var(--color-text-secondary);
  }

  .toggle-icon {
    font-size: 0.8rem;
    transition: transform 0.2s ease;
  }

  .toggle-icon.expanded {
    transform: rotate(90deg);
  }

  /* Sizes */
  .btn-small {
    padding: 12px;
    font-size: 0.9rem;
    border-radius: 6px;
  }

  .btn-medium {
    padding: 16px;
    font-size: 1rem;
  }

  .btn-large {
    padding: 20px;
    font-size: 1.125rem;
  }
</style>
