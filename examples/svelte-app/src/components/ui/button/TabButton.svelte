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
  /* 下線タブの 1 項目。アクティブはアクセント色の下線と濃い文字で示す。
     親の下罫線（1px）に下線を重ねるため margin-bottom: -1px にしている。 */
  .btn {
    flex: 0 0 auto;
    padding: 0 0 12px;
    margin-bottom: -1px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    cursor: pointer;
    font-size: 1rem;
    color: var(--color-text-secondary);
    transition:
      color 0.2s ease,
      border-color 0.2s ease;
    font-family: inherit;
    font-weight: 500;
  }

  .btn:focus {
    outline: none;
  }

  /* 文字や下線に密着しないよう、余白を取ったアウトラインでフォーカスを示す */
  .btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
    /* 全体共通の button:focus-visible の淡い box-shadow を打ち消し、二重枠にしない */
    box-shadow: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Tab Button */
  .btn-tab.active {
    color: var(--color-titles);
    font-weight: 600;
    border-bottom-color: var(--color-primary);
  }

  .btn-tab:hover:not(:disabled):not(.active) {
    background: none;
    color: var(--color-text);
  }
</style>
