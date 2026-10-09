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
    gap: 2px;
    background: none;
    border: none;
    padding: 8px 12px 10px;
    font-size: 0.68rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    cursor: pointer;
    flex: 1;
    border-radius: 0px;
    transition: color 0.2s ease;
    position: relative;
    outline: none;
  }

  .btn:hover {
    color: var(--color-text);
    background: none;
  }

  .btn:focus-visible :global(.icon) {
    box-shadow: 0 0 0 2px var(--color-primary);
  }

  .btn.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  .btn:disabled {
    opacity: 0.5;
  }

  /* アイコンを包むピル。アクティブ時にトーナルな塗りでインジケータにする。 */
  .btn-nav :global(.icon) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 30px;
    border-radius: 999px;
    margin-bottom: 0;
    transition: background-color 0.2s ease;
  }

  .btn:hover:not(.active) :global(.icon) {
    background-color: var(--color-primary-alpha-08);
  }

  .btn.active :global(.icon) {
    background-color: var(--color-primary-alpha-20);
  }

  .btn-nav :global(.icon img) {
    width: 22px;
    height: 22px;
    transition: filter 0.2s ease;
    filter: brightness(0) saturate(100%) invert(50%) sepia(0%) saturate(0%)
      hue-rotate(0deg) brightness(100%) contrast(70%);
  }

  .btn.active :global(.icon img) {
    filter: var(--icon-filter-primary);
  }
</style>
