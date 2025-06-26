<script lang="ts">
// 共通のカードセクションコンポーネント
export let title: string;
</script>

<div class="card-section">
  <h2>{title}</h2>
  <slot />
</div>

<style>
  .card-section {
    background-color: var(--color-card);
    padding: 20px 60px;
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
      padding: 20px;
    }
  }

  h2 {
    margin-bottom: 15px;
    color: var(--color-titles);
    text-align: left;
    transition: color 0.3s ease;
  }
</style>
