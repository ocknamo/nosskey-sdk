<script lang="ts">
import { i18n, termMode } from '../../i18n/i18n-store.js';
import AppInfo from '../settings/AppInfo.svelte';
import ConsentPolicySettings from '../settings/ConsentPolicySettings.svelte';
import DeveloperSection from '../settings/DeveloperSection.svelte';
import LanguageSettings from '../settings/LanguageSettings.svelte';
import RelaySettings from '../settings/RelaySettings.svelte';
import TermModeSettings from '../settings/TermModeSettings.svelte';
import TrustedOriginsSettings from '../settings/TrustedOriginsSettings.svelte';
import ThemeSettings from '../settings/theme-settings.svelte';

type SectionId =
  | 'relays'
  | 'consent'
  | 'trusted'
  | 'language'
  | 'term-mode'
  | 'theme'
  | 'app-info'
  | 'developer';

interface TocItem {
  id: SectionId;
  label: string;
}

// 固定ヘッダー分のオフセット。セクション見出しがヘッダーに隠れない位置を「先頭」とみなす。
// CSS の scroll-margin-top と揃えること。
const SECTION_TOP_OFFSET = 80;

const isStandard = $derived($termMode === 'standard');

// 目次の項目。表示中のセクションと同じ順・同じ条件で並べる。
const tocItems = $derived.by<TocItem[]>(() => {
  const t = $i18n.t.settings;
  return [
    ...(isStandard
      ? [
          { id: 'relays', label: t.relays.title },
          { id: 'consent', label: t.consentPolicy.title },
        ]
      : []),
    { id: 'trusted', label: t.trustedOrigins.title },
    { id: 'language', label: t.language.title },
    { id: 'term-mode', label: t.termMode.title },
    { id: 'theme', label: t.theme.title },
    { id: 'app-info', label: t.appInfo.title },
    ...(isStandard ? [{ id: 'developer', label: t.developer.title }] : []),
  ] as TocItem[];
});

let activeId = $state<SectionId | ''>('');

// 目次クリックによるスムーススクロール中は、スクロール連動のハイライト更新を止める
// （途中のセクションを経由してハイライトがちらつくのを防ぐ）。クリックごとに番号を
// 振り、古いクリックの解除処理が新しいクリックのロックを外さないようにする。
let scrollLockToken = 0;
let scrollLocked = false;

function sectionElementId(id: SectionId): string {
  return `settings-section-${id}`;
}

// 現在のスクロール位置から、目次でハイライトするセクションを決める。
function updateActiveFromScroll() {
  if (scrollLocked) return;
  const items = tocItems;
  if (items.length === 0) return;

  const doc = document.documentElement;
  const atBottom =
    window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
  if (atBottom) {
    // 末尾付近の短いセクションは先頭まで到達できないため、最下部では最後を選ぶ。
    activeId = items[items.length - 1].id;
    return;
  }

  let current: SectionId = items[0].id;
  for (const item of items) {
    const el = document.getElementById(sectionElementId(item.id));
    if (el && el.getBoundingClientRect().top - SECTION_TOP_OFFSET <= 1) {
      current = item.id;
    }
  }
  activeId = current;
}

// 目次から選んだセクションへスクロールし、キーボード・支援技術のためにフォーカスも移す。
function scrollToSection(id: SectionId) {
  const el = document.getElementById(sectionElementId(id));
  if (!el) return;

  activeId = id;
  scrollLocked = true;
  const token = ++scrollLockToken;
  const release = () => {
    if (token === scrollLockToken) scrollLocked = false;
  };
  window.addEventListener('scrollend', release, { once: true });
  // scrollend 非対応ブラウザや、スクロール量 0 で scrollend が来ない場合の保険。
  setTimeout(release, 1000);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

// スクロール・リサイズに合わせて目次のハイライトを更新する。モード切替で
// セクション構成が変わったときも再計算する（tocItems を依存に含める）。
$effect(() => {
  void tocItems;
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      updateActiveFromScroll();
    });
  };
  schedule();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
  };
});
</script>

<!-- PC は「左: 目次のサイドパネル（追従） / 右: 設定カードの 1 列」。目次を選ぶと右の
     該当セクションへスクロールし、スクロール位置に応じて目次のハイライトが追従する。
     モバイルは目次を出さず、従来どおりカードを 1 列に並べる。 -->
<div class="settings-container">
  <nav class="settings-toc" aria-label={$i18n.t.navigation.settingsToc}>
    <p class="settings-toc__title">{$i18n.t.navigation.settings}</p>
    <ul class="settings-toc__list">
      {#each tocItems as item (item.id)}
        <li>
          <button
            type="button"
            class="settings-toc__item"
            class:active={activeId === item.id}
            aria-current={activeId === item.id ? "true" : undefined}
            onclick={() => scrollToSection(item.id)}
          >
            {item.label}
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="settings-content">
    {#if isStandard}
      <section id={sectionElementId("relays")} class="settings-section" tabindex="-1">
        <RelaySettings />
      </section>
      <section id={sectionElementId("consent")} class="settings-section" tabindex="-1">
        <ConsentPolicySettings />
      </section>
    {/if}
    <section id={sectionElementId("trusted")} class="settings-section" tabindex="-1">
      <TrustedOriginsSettings />
    </section>
    <section id={sectionElementId("language")} class="settings-section" tabindex="-1">
      <LanguageSettings />
    </section>
    <section id={sectionElementId("term-mode")} class="settings-section" tabindex="-1">
      <TermModeSettings />
    </section>
    <section id={sectionElementId("theme")} class="settings-section" tabindex="-1">
      <ThemeSettings />
    </section>
    <section id={sectionElementId("app-info")} class="settings-section" tabindex="-1">
      <AppInfo />
    </section>
    {#if isStandard}
      <section id={sectionElementId("developer")} class="settings-section" tabindex="-1">
        <DeveloperSection />
      </section>
    {/if}
  </div>
</div>

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
  }

  .settings-toc {
    display: none;
  }

  .settings-section {
    /* 目次からのスクロールで見出しが固定ヘッダーに隠れないようにする（SECTION_TOP_OFFSET と揃える） */
    scroll-margin-top: 80px;
  }

  /* プログラムからのフォーカス移動先なのでリングは出さない */
  .settings-section:focus {
    outline: none;
  }

  @media (min-width: 960px) {
    .settings-container {
      max-width: 1040px;
      padding: 8px 24px 24px;
      display: grid;
      grid-template-columns: 220px minmax(0, 720px);
      justify-content: center;
      gap: 32px;
      align-items: start;
    }

    .settings-toc {
      display: block;
      position: sticky;
      top: 80px;
      padding: 12px;
      text-align: left;
      background-color: var(--color-card);
      border: var(--border-width, 1px) solid var(--color-border);
      border-radius: 16px;
      box-shadow: 0 1px 2px var(--color-shadow);
    }

    .settings-toc__title {
      margin: 4px 10px 8px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
    }

    .settings-toc__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .settings-toc__list li {
      margin: 0;
      font-size: inherit;
    }

    .settings-toc__item {
      position: relative;
      display: block;
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-radius: 10px;
      background: none;
      color: var(--color-text-secondary);
      font-size: 0.9rem;
      font-weight: 500;
      text-align: left;
      line-height: 1.4;
    }

    .settings-toc__item:hover:not(.active) {
      background-color: var(--color-surface-hover);
      color: var(--color-text);
    }

    .settings-toc__item:focus-visible {
      box-shadow: 0 0 0 2px var(--color-button-primary);
    }

    .settings-toc__item.active {
      background-color: var(--color-primary-alpha-08);
      color: var(--color-titles);
      font-weight: 600;
    }

    /* アクティブ項目の左端にアクセント色のバー */
    .settings-toc__item.active::before {
      content: "";
      position: absolute;
      left: 0;
      top: 8px;
      bottom: 8px;
      width: 3px;
      border-radius: 3px;
      background-color: var(--color-primary);
    }

    .settings-content {
      min-width: 0;
    }
  }
</style>
