<script lang="ts">
// 共通の設定セクションコンポーネント
export let title: string;
</script>

<div class="settings-section">
  <h2>{title}</h2>
  <slot />
</div>

<style>
  .settings-section {
    background-color: #ffffff;
    padding: 20px 60px;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
  }

  @media (max-width: 900px) {
    .settings-section {
      padding: 20px;
    }
  }

  h2 {
    margin-bottom: 15px;
  }
</style>
