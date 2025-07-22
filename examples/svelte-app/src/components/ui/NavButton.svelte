<script lang="ts">
const {
  disabled = false,
  onclick = undefined,
  buttonType = 'button' as 'button' | 'submit' | 'reset',
  title = undefined,
  className = '',
  active = false,
  ariaLabel = undefined,
  ariaCurrent = undefined,
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
  aria-label={ariaLabel}
  aria-current={ariaCurrent}
  class={`btn btn-nav ${className}`}
  class:active
  onclick={handleClick}
>
  {@render children?.()}
</button>

<style>
  .btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: none;
    border: none;
    padding: 8px 16px 14px;
    font-size: 0.6rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    flex: 1;
    border-radius: 0px;
    transition: all 0.2s ease;
    position: relative;
    outline: none;
  }

  .btn:hover {
    background-color: var(--color-primary-alpha-08);
  }

  .btn.active {
    color: var(--color-primary);
    font-weight: bold;
    border-top: 2px solid var(--color-primary);
  }

  .btn:disabled {
    opacity: 0.5;
  }

  /* Nav Button specific styles */
  .btn-nav :global(.icon) {
    font-size: 1.5rem;
    margin-bottom: 0;
  }

  .btn-nav :global(.icon img) {
    width: 24px;
    height: 24px;
    transition: filter 0.2s ease;
    filter: brightness(0) saturate(100%) invert(50%) sepia(0%) saturate(0%)
      hue-rotate(0deg) brightness(100%) contrast(70%);
  }

  .btn.active :global(.icon img) {
    filter: brightness(0) saturate(100%) invert(44%) sepia(74%) saturate(647%)
      hue-rotate(225deg) brightness(94%) contrast(89%);
  }
</style>
