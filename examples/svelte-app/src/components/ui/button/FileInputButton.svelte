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
    border: none;
    border-radius: 6px;
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

  .btn.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* File Input Button */
  .btn-file {
    background-color: var(--color-info);
    color: white;
  }

  .btn-file:hover:not(.disabled) {
    opacity: 0.9;
  }

  /* Sizes */
  .btn-small {
    padding: 8px 16px;
    font-size: 0.875rem;
    border-radius: 4px;
  }

  .btn-medium {
    padding: 12px 20px;
    font-size: 0.95rem;
  }

  .btn-large {
    padding: 16px 24px;
    font-size: 1.125rem;
  }
</style>
