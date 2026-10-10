<script lang="ts">
import { i18n } from '../../i18n/i18n-store.js';
import { NOSSKEY_APPS } from '../apps/nosskey-apps.js';
</script>

<!-- Nosskey でログインできるアプリの紹介。モバイルは 1 列、PC はカードを 3 列に並べる。 -->
<div class="apps-screen">
  <div class="apps-intro">
    <h2 class="apps-title">{$i18n.t.apps.title}</h2>
    <p class="apps-lead">{$i18n.t.apps.lead}</p>
  </div>

  <ul class="apps-list">
    {#each NOSSKEY_APPS as app (app.id)}
      <li class="app-card">
        <div class="app-card__header">
          <img class="app-card__icon" src={app.icon} alt="" width="56" height="56" />
          <h3 class="app-card__name">{app.name}</h3>
        </div>
        <p class="app-card__description">{$i18n.t.apps.descriptions[app.descriptionKey]}</p>
        <div class="app-card__actions">
          <a class="app-card__open" href={app.url} target="_blank" rel="noopener noreferrer">
            {$i18n.t.apps.open}
          </a>
          <a
            class="app-card__source"
            href={app.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {$i18n.t.apps.source}
          </a>
        </div>
      </li>
    {/each}
  </ul>

  <p class="apps-note" role="note">{$i18n.t.apps.howToLogin}</p>
</div>

<style>
  .apps-screen {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    text-align: left;
  }

  @media (min-width: 960px) {
    /* 左端をヘッダーのロゴ・他画面（max-width 1120px）と揃える */
    .apps-screen {
      max-width: 1120px;
      padding: 8px 24px 24px;
    }
  }

  .apps-intro {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .apps-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--color-titles);
  }

  .apps-lead {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .apps-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  @media (min-width: 960px) {
    .apps-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 20px;
    }
  }

  .app-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background-color: var(--color-card);
    padding: 20px;
    border-radius: 16px;
    border: var(--border-width, 1px) solid var(--color-border);
    box-shadow:
      0 1px 2px var(--color-shadow),
      0 4px 12px -6px var(--color-shadow);
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }

  .app-card__header {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .app-card__icon {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 14px;
    border: 1px solid var(--color-border-light);
    object-fit: cover;
  }

  .app-card__name {
    margin: 0;
    min-width: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-titles);
    overflow-wrap: anywhere;
  }

  .app-card__description {
    margin: 0;
    flex: 1;
    font-size: 0.9rem;
    color: var(--color-text);
  }

  .app-card__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  /* Button.svelte の primary と同じ見た目のリンク */
  .app-card__open {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 18px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.9rem;
    line-height: 1.2;
    text-decoration: none;
    background-color: var(--color-button-primary);
    color: var(--color-text-on-primary);
    box-shadow:
      0 1px 2px var(--color-shadow),
      0 2px 8px -2px var(--color-primary-glow);
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .app-card__open:hover {
    background-color: var(--color-button-primary-hover);
  }

  .app-card__open:focus-visible,
  .app-card__source:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px var(--color-card),
      0 0 0 4px var(--color-primary);
  }

  .app-card__source {
    font-size: 0.85rem;
    color: var(--color-primary);
    text-decoration: none;
    border-radius: 4px;
  }

  .app-card__source:hover {
    text-decoration: underline;
  }

  .apps-note {
    margin: 0;
    max-width: 640px;
    border-left: 3px solid var(--color-primary);
    padding: 2px 12px;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }
</style>
