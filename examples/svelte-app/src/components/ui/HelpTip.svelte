<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';

interface Props {
  text: string;
}

const { text }: Props = $props();

// 1コンポーネントインスタンスごとに一意の id を発番し aria-describedby と紐付ける。
// `crypto.randomUUID()` は古い jsdom テスト環境などで存在しないことがあるため
// Math.random ベースのフォールバックを併用する。
const tipId = `help-tip-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
</script>

<span class="help-tip">
  <button
    type="button"
    class="help-tip__trigger"
    aria-describedby={tipId}
    aria-label={$i18n.t.common.help}
  >?</button>
  <span role="tooltip" id={tipId} class="help-tip__bubble">{text}</span>
</span>

<style>
  .help-tip {
    position: relative;
    display: inline-flex;
    vertical-align: middle;
    margin-left: 6px;
  }

  .help-tip__trigger {
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 50%;
    border: 1.5px solid var(--color-border-medium);
    background: transparent;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    cursor: help;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      border-color 0.2s ease,
      color 0.2s ease,
      background-color 0.2s ease;
  }

  .help-tip__trigger:hover,
  .help-tip__trigger:focus-visible {
    border-color: var(--color-primary);
    color: var(--color-primary);
    outline: none;
  }

  .help-tip__bubble {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: min(240px, calc(100vw - 32px));
    padding: 8px 10px;
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border-medium);
    border-radius: 6px;
    box-shadow: 0 4px 12px var(--color-shadow);
    font-size: 0.85rem;
    font-weight: 400;
    line-height: 1.4;
    text-align: left;
    white-space: normal;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      visibility 0.15s ease;
    z-index: 10;
  }

  .help-tip:hover .help-tip__bubble,
  .help-tip:focus-within .help-tip__bubble {
    opacity: 1;
    visibility: visible;
  }
</style>
