<script lang="ts">
import type { Snippet } from 'svelte';

// 共通のカードセクションコンポーネント
interface Props {
  title: string;
  compact?: boolean;
  children?: Snippet;
  titleAside?: Snippet;
}

const { title, compact = false, children, titleAside }: Props = $props();
</script>

<div class="card-section" class:compact>
  <div class="card-section__header">
    <h2>{title}</h2>
    {#if titleAside}
      <span class="card-section__aside">{@render titleAside()}</span>
    {/if}
  </div>
  {@render children?.()}
</div>

<style>
  .card-section {
    background-color: var(--color-card);
    padding: 12px 60px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    box-shadow: 0 2px 4px var(--color-shadow);
    margin-bottom: 20px;
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  @media (max-width: 900px) {
    .card-section {
      padding: 12px 20px;
    }
  }

  .card-section.compact {
    padding: 12px 16px;
    margin-bottom: 16px;
  }

  @media (max-width: 900px) {
    .card-section.compact {
      padding: 12px;
    }
  }

  .card-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .card-section.compact .card-section__header {
    margin-bottom: 8px;
  }

  .card-section__aside {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  h2 {
    margin: 0;
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
    text-align: left;
    transition: color 0.3s ease;
  }
</style>
