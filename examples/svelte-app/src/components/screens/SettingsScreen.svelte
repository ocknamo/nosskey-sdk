<script lang="ts" module>
// 直前に計算した末尾余白の高さ。画面を離れて戻ったとき、App.svelte のスクロール位置
// 復元（tick 直後）より前に余白を効かせ、深い位置の復元が文書の高さ不足で切り詰め
// られないようにするため、再マウントをまたいで保持する。
let lastTailSpacerHeight = 0;
</script>

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

// PC レイアウト（目次を表示する幅）か。CSS の @media (min-width: 960px) と揃えること。
const DESKTOP_QUERY = '(min-width: 960px)';

let activeId = $state<SectionId | ''>('');
// 実際にハイライトする項目。未計算の間やモード切替で項目が消えた直後も、
// 先頭項目へフォールバックしてハイライトが空にならないようにする。
const currentId = $derived(
  tocItems.some((item) => item.id === activeId) ? activeId : (tocItems[0]?.id ?? '')
);
// 末尾のセクションも目次から「先頭」へスクロールできるよう、内容の下に足す余白（px）。
let tailSpacerHeight = $state(lastTailSpacerHeight);
let contentEl = $state<HTMLElement | undefined>();

// 目次クリックによるスムーススクロール中は、スクロール連動のハイライト更新を止める
// （途中のセクションを経由してハイライトがちらつくのを防ぐ）。クリックごとに番号を
// 振り、古いクリックの解除処理が新しいクリックのロックを外さないようにする。
let scrollLockToken = 0;
let scrollLocked = false;
// 直前のクリックで仕掛けた scrollend リスナーとタイマーの後始末。
let cancelPendingRelease: (() => void) | null = null;

let frame = 0;

// セクション要素の id（ハッシュルーティングと衝突しないよう、リンクではなく id 参照で使う）。
function sectionElementId(id: SectionId): string {
  return `settings-section-${id}`;
}

// 次のフレームで目次のハイライトと末尾余白を計算し直す（同一フレーム内の多重要求はまとめる）。
function scheduleUpdate() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    updateTailSpacer();
    updateActiveFromScroll();
  });
}

// 最後のセクションの上端が固定ヘッダー直下（SECTION_TOP_OFFSET）まで届くだけの余白を足す。
// これにより、末尾の短いセクションもクリック・スクロールの両方で正しくハイライトされる。
function updateTailSpacer() {
  const items = tocItems;
  if (!window.matchMedia(DESKTOP_QUERY).matches || items.length === 0) {
    tailSpacerHeight = lastTailSpacerHeight = 0;
    return;
  }
  const last = document.getElementById(sectionElementId(items[items.length - 1].id));
  if (!last) return;
  const doc = document.documentElement;
  const heightWithoutSpacer = doc.scrollHeight - tailSpacerHeight;
  const lastTopInDoc = last.getBoundingClientRect().top + window.scrollY;
  const needed = lastTopInDoc - SECTION_TOP_OFFSET + window.innerHeight - heightWithoutSpacer;
  tailSpacerHeight = lastTailSpacerHeight = Math.max(0, Math.ceil(needed));
}

// 現在のスクロール位置から、目次でハイライトするセクションを決める。
// 上端が固定ヘッダー直下を越えた最後のセクションを「現在地」とする。
function updateActiveFromScroll() {
  if (scrollLocked) return;
  const items = tocItems;
  if (items.length === 0) return;
  // 目次を表示しない幅では計算しない。
  if (!window.matchMedia(DESKTOP_QUERY).matches) return;

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

  cancelPendingRelease?.();
  activeId = id;
  scrollLocked = true;
  const token = ++scrollLockToken;

  let timer = 0;
  const release = () => {
    cleanup();
    if (token !== scrollLockToken) return;
    scrollLocked = false;
    // ロック中のスクロールで読み飛ばした分を反映する（ユーザーが途中で動かした場合など）。
    scheduleUpdate();
  };
  const cleanup = () => {
    window.removeEventListener('scrollend', release);
    clearTimeout(timer);
    if (cancelPendingRelease === cleanup) cancelPendingRelease = null;
  };
  window.addEventListener('scrollend', release);
  // scrollend 非対応ブラウザや、スクロール量 0 で scrollend が来ない場合の保険。
  timer = window.setTimeout(release, 1000);
  cancelPendingRelease = cleanup;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

// スクロール・リサイズ・内容の高さ変化に合わせて目次のハイライトと末尾余白を更新する。
// モード切替でセクション構成が変わったときも再計算する（tocItems を依存に含める）。
$effect(() => {
  void tocItems;
  const target = contentEl;
  scheduleUpdate();
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  // 開発者向けセクションの展開やリレー追加など、内容の高さが変わったときも追従する。
  const observer = target ? new ResizeObserver(scheduleUpdate) : null;
  if (target) observer?.observe(target);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    observer?.disconnect();
  };
});

// 画面を離れるときに、目次クリックで仕掛けたリスナーとタイマーを片付ける。
$effect(() => {
  return () => {
    cancelPendingRelease?.();
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
            class:active={currentId === item.id}
            aria-current={currentId === item.id ? "location" : undefined}
            onclick={() => scrollToSection(item.id)}
          >
            {item.label}
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="settings-content" bind:this={contentEl}>
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
    <div class="settings-tail-spacer" style:height="{tailSpacerHeight}px" aria-hidden="true"></div>
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
    /* 左端をヘッダーのロゴ・他画面（max-width 1120px）と揃える */
    .settings-container {
      max-width: 1120px;
      padding: 8px 24px 24px;
      display: grid;
      grid-template-columns: 240px minmax(0, 1fr);
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
