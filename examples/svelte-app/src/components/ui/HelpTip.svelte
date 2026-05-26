<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';

type Placement = 'center' | 'start' | 'end';

interface Props {
  text: string;
  /**
   * バブルをトリガに対してどう揃えるか。
   * `center` はトリガ中央寄せ（デフォルト）。
   * `start` はトリガの左端にバブル左端を揃え、右方向へ伸ばす。
   * `end`   はトリガの右端にバブル右端を揃え、左方向へ伸ばす。
   * 画面端付近のトリガでビューポート外にはみ出さないよう、呼び出し側で指定する。
   */
  placement?: Placement;
}

const { text, placement = 'center' }: Props = $props();

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
  <span
    role="tooltip"
    id={tipId}
    class="help-tip__bubble help-tip__bubble--{placement}"
  >{text}</span>
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

  /*
   * 非表示時は `display: none` で layout から完全に外す。
   * `visibility: hidden` だと scrollable overflow に参加してしまい、
   * トリガがビューポート右端付近にあるとき横スクロールが発生する。
   */
  .help-tip__bubble {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
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
    z-index: 10;
  }

  .help-tip__bubble--center {
    left: 50%;
    transform: translateX(-50%);
  }

  .help-tip__bubble--start {
    left: 0;
  }

  .help-tip__bubble--end {
    right: 0;
  }

  .help-tip:hover .help-tip__bubble,
  .help-tip:focus-within .help-tip__bubble {
    display: block;
  }
</style>
