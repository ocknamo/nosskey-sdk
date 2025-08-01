<script lang="ts">
type ButtonSize = 'small' | 'medium' | 'large';
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning';

const {
  disabled = false,
  size = 'medium' as ButtonSize,
  variant = 'primary' as ButtonVariant,
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
  class={`btn btn-${variant} btn-${size} ${className}`}
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
    width: 100%;
    max-width: 360px;
  }

  .btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-alpha-20);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Primary Button */
  .btn-primary {
    background-color: var(--color-button-primary);
    color: var(--color-text-on-primary);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-button-primary-hover);
  }

  .btn-primary:disabled {
    background-color: var(--color-button-disabled);
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

  /* Danger Button */
  .btn-danger {
    background-color: var(--color-error);
    color: var(--color-text-on-primary);
  }

  .btn-danger:hover:not(:disabled) {
    background-color: var(--color-button-danger-hover);
  }

  .btn-danger:disabled {
    background-color: var(--color-button-danger-disabled);
  }

  /* Success Button */
  .btn-success {
    background-color: var(--color-button-success);
    color: var(--color-text-on-primary);
  }

  .btn-success:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-success:disabled {
    background-color: var(--color-button-disabled);
  }

  /* Warning Button */
  .btn-warning {
    background-color: var(--color-warning);
    color: var(--color-text-inverse);
  }

  .btn-warning:hover:not(:disabled) {
    background-color: var(--color-button-warning-hover);
  }

  .btn-warning:disabled {
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
