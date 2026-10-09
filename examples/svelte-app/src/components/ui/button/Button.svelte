<script lang="ts">
type ButtonSize = 'small' | 'medium' | 'large';
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning';

const {
  disabled = false,
  size = 'medium' as ButtonSize,
  variant = 'primary' as ButtonVariant,
  fullWidth = true,
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
  class={`btn btn-${variant} btn-${size} ${fullWidth ? '' : 'btn-auto-width'} ${className}`}
  onclick={handleClick}
>
  {@render children?.()}
</button>

<style>
  .btn {
    position: relative;
    border: 1px solid transparent;
    border-radius: 12px;
    font-family: inherit;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.1s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    line-height: 1.2;
    width: 100%;
    max-width: 360px;
  }

  .btn:focus {
    outline: none;
  }

  .btn:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px var(--color-card),
      0 0 0 4px var(--color-button-primary);
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    box-shadow: none;
  }

  .btn-auto-width {
    width: auto;
    max-width: none;
  }

  /* Primary Button: 単色の塗り + アクセント色の柔らかい影 */
  .btn-primary {
    background-color: var(--color-button-primary);
    color: var(--color-text-on-primary);
    box-shadow:
      0 1px 2px var(--color-shadow),
      0 2px 8px -2px var(--color-primary-glow);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-button-primary-hover);
    box-shadow:
      0 1px 2px var(--color-shadow),
      0 4px 10px -2px var(--color-primary-glow);
  }

  .btn-primary:disabled {
    background-color: var(--color-button-disabled);
    color: var(--color-text-disabled);
  }

  /* Secondary Button: 落ち着いた面ボタン */
  .btn-secondary {
    background-color: var(--color-button-secondary);
    border-color: var(--color-border);
    color: var(--color-button-secondary-text);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-button-secondary-hover);
    border-color: var(--color-border-strong);
  }

  /* Danger Button */
  .btn-danger {
    background-color: var(--color-button-danger);
    color: var(--color-text-on-primary);
    box-shadow: 0 1px 2px var(--color-shadow);
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
    box-shadow: 0 1px 2px var(--color-shadow);
  }

  .btn-success:hover:not(:disabled) {
    background-color: var(--color-button-success-hover);
  }

  .btn-success:disabled {
    background-color: var(--color-button-disabled);
  }

  /* Warning Button: 注意喚起はトーナル（淡い塗り + 色文字 + 色枠）で控えめに */
  .btn-warning {
    background-color: var(--color-warning-bg);
    border-color: var(--color-warning-border);
    color: var(--color-warning);
  }

  .btn-warning:hover:not(:disabled) {
    border-color: var(--color-warning);
    background-color: color-mix(in srgb, var(--color-warning) 18%, transparent);
  }

  /* Sizes */
  .btn-small {
    padding: 7px 14px;
    font-size: 0.875rem;
    border-radius: 10px;
  }

  .btn-medium {
    padding: 11px 20px;
    font-size: 0.95rem;
  }

  .btn-large {
    padding: 14px 24px;
    font-size: 1.05rem;
    border-radius: 14px;
  }
</style>
