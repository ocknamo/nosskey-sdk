<script lang="ts">
// 設定変更時のフィードバックメッセージ（コントロール直下に表示）
interface Props {
  message: string;
  type?: 'success' | 'error';
}

const { message, type = 'success' }: Props = $props();
</script>

{#if message}
  <div class="setting-message" class:error={type === 'error'} aria-live="polite">
    {message}
  </div>
{/if}

<style>
  .setting-message {
    margin-top: 12px;
    padding: 10px 12px;
    background-color: var(--color-success-bg);
    border: 1px solid var(--color-success-border);
    border-radius: 8px;
    color: var(--color-success);
    font-size: 0.9rem;
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease,
      color 0.3s ease;
  }

  .setting-message.error {
    background-color: var(--color-warning-bg);
    border-color: var(--color-warning-border);
    color: var(--color-warning);
  }
</style>
