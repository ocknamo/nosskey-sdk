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
    padding: 20px 24px 24px;
    border-radius: 16px;
    border: var(--border-width, 1px) solid var(--color-border);
    box-shadow:
      0 1px 2px var(--color-shadow),
      0 4px 12px -6px var(--color-shadow);
    margin-bottom: 20px;
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  @media (max-width: 600px) {
    .card-section {
      padding: 16px 18px 20px;
    }
  }

  .card-section.compact {
    padding: 14px 16px;
    margin-bottom: 16px;
  }

  @media (max-width: 600px) {
    .card-section.compact {
      padding: 12px;
    }
  }

  .card-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
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
    font-family: var(--font-family);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--color-titles);
    text-align: left;
    transition: color 0.3s ease;
  }

  .card-section.compact h2 {
    font-size: 0.9rem;
  }
</style>
