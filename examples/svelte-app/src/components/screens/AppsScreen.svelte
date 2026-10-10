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
          <!-- 同じ文言のリンクがカードごとに並ぶので、読み上げではアプリ名と新しいタブで開く旨を添える -->
          <a
            class="app-card__open"
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${app.name}: ${$i18n.t.apps.open} (${$i18n.t.apps.opensInNewTab})`}
          >
            {$i18n.t.apps.open}
          </a>
          <a
            class="app-card__source"
            href={app.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={$i18n.t.apps.source}
            aria-label={`${app.name}: ${$i18n.t.apps.source} (${$i18n.t.apps.opensInNewTab})`}
          >
            <!-- GitHub マーク（Primer Octicons の mark-github） -->
            <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
              />
            </svg>
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
    gap: 8px 12px;
  }

  /* Button.svelte の primary と同じ見た目のリンク */
  .app-card__open {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: 120px;
    padding: 10px 28px;
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

  /* アイコンだけのリンクなので、押しやすいよう 40px 角の当たり判定を取る */
  .app-card__source {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    color: var(--color-text-secondary);
    transition:
      color 0.2s ease,
      background-color 0.2s ease;
  }

  .app-card__source:hover {
    color: var(--color-text);
    background-color: var(--color-button-secondary-hover);
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
