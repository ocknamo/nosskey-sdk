<script lang="ts">
type ButtonSize = 'small' | 'medium' | 'large';

const {
  disabled = false,
  size = 'medium' as ButtonSize,
  onchange = undefined,
  accept = undefined,
  title = undefined,
  className = '',
  inputId = 'file-input',
  children,
} = $props();

function handleChange(event: Event) {
  if (!disabled && onchange) {
    onchange(event);
  }
}
</script>

<div class="file-input-wrapper">
  <input
    type="file"
    id={inputId}
    {accept}
    onchange={handleChange}
    {disabled}
    class="file-input-hidden"
  />
  <label
    for={inputId}
    class={`btn btn-file btn-${size} ${className}`}
    class:disabled
    {title}
  >
    {@render children?.()}
  </label>
</div>

<style>
  .file-input-wrapper {
    display: inline-block;
  }

  .file-input-hidden {
    display: none;
  }

  .btn {
    border: 1px solid var(--color-border);
    border-radius: 12px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    line-height: 1.2;
  }

  .btn:focus {
    outline: none;
  }

  .btn.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* File Input Button: secondary ボタンと同じ面ボタン */
  .btn-file {
    background-color: var(--color-button-secondary);
    color: var(--color-button-secondary-text);
  }

  .btn-file:hover:not(.disabled) {
    background-color: var(--color-button-secondary-hover);
    border-color: var(--color-border-strong);
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
  }
</style>
