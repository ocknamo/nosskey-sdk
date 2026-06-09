// テーマ定義。`App.svelte` の `applyTheme()` が選択テーマを解決し、対応する
// パレット（CSS custom properties のマップ）を `document.documentElement` に適用する。
//
// 設計メモ:
// - `ThemeMode` はユーザーが選択・永続化する値（4 カラーテーマ + `auto`）。
// - `ResolvedTheme` は実際に適用される 4 テーマ。`auto` は OS の prefers-color-scheme で
//   パープル系（既定ファミリ）の dark/light に解決される。
// - ニュートラル系は dark/light をベースにアクセント（primary 系）のみグレー無彩色へ置換。
//   status 色（success/warning/error/info）は意味色のため据え置く。

export type ThemeMode = 'purple-dark' | 'purple-light' | 'neutral-dark' | 'neutral-light' | 'auto';

export type ResolvedTheme = 'purple-dark' | 'purple-light' | 'neutral-dark' | 'neutral-light';

// フォントスタック。パープル系は従来のシステムフォント、ニュートラル系は丸ゴシック
// （M PLUS Rounded 1c を Google Fonts から読み込み、未ロード時はシステムへフォールバック）。
const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';
const ROUNDED_FONT_STACK = `"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", ${SYSTEM_FONT_STACK}`;

// パープルダーク（旧 'dark'）。現行ダークテーマの値をそのまま移植（見た目不変）。
const PURPLE_DARK: Record<string, string> = {
  '--color-text': '#FFFFFF',
  '--color-titles': '#FFFFFF',
  '--color-primary': '#9E7EF9',
  '--color-secondary': '#383838',
  '--color-tertiary': '#2a2a2a',
  '--color-border': '#222222',
  '--color-card': '#111111',
  '--color-background': '#000000',
  '--color-text-secondary': '#AAAAAA',
  '--color-text-on-primary': '#FFFFFF',

  // 状態色（ダーク）
  '--color-success': '#52c41a',
  '--color-warning': '#faad14',
  '--color-error': '#ff4d4f',
  '--color-info': '#40a9ff',

  // 背景色バリエーション（ダーク）
  '--color-surface': '#1a1a1a',
  '--color-overlay': '#2a2a2a',
  '--color-surface-alt': '#333333',
  '--color-surface-light': '#444444',

  // テキスト色バリエーション（ダーク）
  '--color-text-primary': '#FFFFFF',
  '--color-text-disabled': '#666666',
  '--color-text-muted': '#AAAAAA',
  '--color-text-inverse': '#000000',
  '--color-text-dark': '#CCCCCC',

  // ボーダー色バリエーション（ダーク）
  '--color-border-strong': '#444444',
  '--color-border-light': '#333333',
  '--color-border-medium': '#555555',

  // ボタン色（ダーク）
  '--color-button-primary': '#9E7EF9',
  '--color-button-secondary': '#555555',
  '--color-button-success': '#52c41a',
  '--color-button-warning': '#faad14',
  '--color-button-danger': '#ff4d4f',
  '--color-button-info': '#40a9ff',

  // ボタンホバー色（ダーク）
  '--color-button-primary-hover': '#b794f6',
  '--color-button-secondary-hover': '#666666',
  '--color-button-success-hover': '#73d13d',
  '--color-button-warning-hover': '#ffc53d',
  '--color-button-danger-hover': '#ff7875',
  '--color-button-info-hover': '#69c0ff',

  // ボタン無効化色（ダーク）
  '--color-button-disabled': '#434343',
  '--color-button-danger-disabled': '#5a2d2d',

  // 透明度付き色（ダーク）
  '--color-primary-alpha-20': 'rgba(158, 126, 249, 0.2)',
  '--color-primary-alpha-08': 'rgba(158, 126, 249, 0.08)',
  '--color-shadow': 'rgba(255, 255, 255, 0.1)',
  '--color-shadow-strong': 'rgba(255, 255, 255, 0.15)',

  // 特殊背景色（ダーク）
  '--color-success-bg': '#162312',
  '--color-warning-bg': '#2b2111',
  '--color-error-bg': '#2a1215',
  '--color-info-bg': '#111b26',
  '--color-surface-hover': '#333333',

  // ボーダー特殊色（ダーク）
  '--color-success-border': '#52c41a',
  '--color-warning-border': '#faad14',
  '--color-error-border': '#ff4d4f',
  '--color-info-border': '#40a9ff',

  // アイコンフィルター（ダーク）
  '--icon-filter': 'invert(1) brightness(1)',

  // primary 色へ着色する SVG アイコン用フィルター（アクティブな nav アイコン等）。
  // 黒 SVG をパープルアクセント (#9E7EF9 相当) へ変換する。
  '--icon-filter-primary':
    'brightness(0) saturate(100%) invert(44%) sepia(74%) saturate(647%) hue-rotate(225deg) brightness(94%) contrast(89%)',

  // ボーダー幅（ダーク）。カード・フレーム類で使う。ニュートラル系はこれを太くして差別化する。
  '--border-width': '1px',

  // フォント（ダーク）。ニュートラル系で丸ゴシックへ差し替える。
  '--font-family': SYSTEM_FONT_STACK,

  // バナーオーバーレイ（ダーク）
  '--banner-overlay-gradient':
    'linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.3) 100%)',
};

// パープルライト（旧 'light'）。現行ライトテーマ (Purple Breeze) の値をそのまま移植（見た目不変）。
const PURPLE_LIGHT: Record<string, string> = {
  '--color-text': '#535465',
  '--color-titles': '#11142D',
  '--color-primary': '#6C5DD3',
  '--color-secondary': '#1B1D21',
  '--color-tertiary': '#B8DCE9',
  '--color-border': '#E4E4E4',
  '--color-card': '#FFFFFF',
  '--color-background': '#F6F6F8',
  '--color-text-secondary': '#7A7A85',
  '--color-text-on-primary': '#FFFFFF',

  // 状態色（ライト）
  '--color-success': '#28a745',
  '--color-warning': '#ffc107',
  '--color-error': '#dc3545',
  '--color-info': '#1890ff',

  // 背景色バリエーション（ライト）
  '--color-surface': '#f8f9fa',
  '--color-overlay': '#f9f9f9',
  '--color-surface-alt': '#f5f5f5',
  '--color-surface-light': '#fafafa',

  // テキスト色バリエーション（ライト）
  '--color-text-primary': '#535465',
  '--color-text-disabled': '#999999',
  '--color-text-muted': '#666666',
  '--color-text-inverse': '#ffffff',
  '--color-text-dark': '#333333',

  // ボーダー色バリエーション（ライト）
  '--color-border-strong': '#dddddd',
  '--color-border-light': '#eeeeee',
  '--color-border-medium': '#cccccc',

  // ボタン色（ライト）
  '--color-button-primary': '#5755d9',
  '--color-button-secondary': '#6c757d',
  '--color-button-success': '#52c41a',
  '--color-button-warning': '#ff9800',
  '--color-button-danger': '#dc3545',
  '--color-button-info': '#1890ff',

  // ボタンホバー色（ライト）
  '--color-button-primary-hover': '#4240b3',
  '--color-button-secondary-hover': '#5a6268',
  '--color-button-success-hover': '#449516',
  '--color-button-warning-hover': '#e68900',
  '--color-button-danger-hover': '#c82333',
  '--color-button-info-hover': '#0d7adb',

  // ボタン無効化色（ライト）
  '--color-button-disabled': '#cccccc',
  '--color-button-danger-disabled': '#e9acb1',

  // 透明度付き色（ライト）
  '--color-primary-alpha-20': 'rgba(108, 93, 211, 0.2)',
  '--color-primary-alpha-08': 'rgba(108, 93, 211, 0.08)',
  '--color-shadow': 'rgba(0, 0, 0, 0.1)',
  '--color-shadow-strong': 'rgba(0, 0, 0, 0.15)',

  // 特殊背景色（ライト）
  '--color-success-bg': '#e6ffed',
  '--color-warning-bg': '#fff3cd',
  '--color-error-bg': '#ffdddd',
  '--color-info-bg': '#e6f7ff',
  '--color-surface-hover': '#eeeeee',

  // ボーダー特殊色（ライト）
  '--color-success-border': '#52c41a',
  '--color-warning-border': '#ffc107',
  '--color-error-border': '#dc3545',
  '--color-info-border': '#1890ff',

  // アイコンフィルター（ライト）
  '--icon-filter': 'none',

  // primary 色へ着色する SVG アイコン用フィルター（アクティブな nav アイコン等）。
  // パープル系はライト/ダークで同一フィルターを共有する。
  '--icon-filter-primary':
    'brightness(0) saturate(100%) invert(44%) sepia(74%) saturate(647%) hue-rotate(225deg) brightness(94%) contrast(89%)',

  // ボーダー幅（ライト）。カード・フレーム類で使う。ニュートラル系はこれを太くして差別化する。
  '--border-width': '1px',

  // フォント（ライト）。ニュートラル系で丸ゴシックへ差し替える。
  '--font-family': SYSTEM_FONT_STACK,

  // バナーオーバーレイ（ライト）
  '--banner-overlay-gradient':
    'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.5) 100%)',
};

// ニュートラルダーク。パープルダークをベースに primary 系アクセントをグレー無彩色へ置換。
const NEUTRAL_DARK: Record<string, string> = {
  ...PURPLE_DARK,
  '--color-primary': '#A0A0A8',
  '--color-button-primary': '#A0A0A8',
  '--color-button-primary-hover': '#C4C4CC',
  '--color-text-on-primary': '#000000',
  '--color-primary-alpha-20': 'rgba(160, 160, 168, 0.2)',
  '--color-primary-alpha-08': 'rgba(160, 160, 168, 0.08)',
  // 黒 SVG を明るいグレー (#A0A0A8 相当) へ着色（hue なし、明度のみ）。
  '--icon-filter-primary': 'brightness(0) saturate(100%) invert(70%)',
  // 差別化: 太いボーダー + 影なし + 丸ゴシック。太線が見えるようカード枠の border 色も強める。
  '--color-border': '#4A4A4E',
  '--border-width': '3px',
  '--color-shadow': 'transparent',
  '--color-shadow-strong': 'transparent',
  '--font-family': ROUNDED_FONT_STACK,
};

// ニュートラルライト。パープルライトをベースに primary 系アクセントをグレー無彩色へ置換。
const NEUTRAL_LIGHT: Record<string, string> = {
  ...PURPLE_LIGHT,
  '--color-primary': '#5A5A66',
  '--color-button-primary': '#5A5A66',
  '--color-button-primary-hover': '#42424D',
  '--color-primary-alpha-20': 'rgba(90, 90, 102, 0.2)',
  '--color-primary-alpha-08': 'rgba(90, 90, 102, 0.08)',
  // 黒 SVG を濃いグレー (#5A5A66 相当) へ着色（hue なし、明度のみ）。
  '--icon-filter-primary': 'brightness(0) saturate(100%) invert(38%)',
  // 差別化: 太いボーダー + 影なし + 丸ゴシック。太線が見えるようカード枠の border 色も強める。
  '--color-border': '#C2C2CC',
  '--border-width': '3px',
  '--color-shadow': 'transparent',
  '--color-shadow-strong': 'transparent',
  '--font-family': ROUNDED_FONT_STACK,
};

export const THEME_PALETTES: Record<ResolvedTheme, Record<string, string>> = {
  'purple-dark': PURPLE_DARK,
  'purple-light': PURPLE_LIGHT,
  'neutral-dark': NEUTRAL_DARK,
  'neutral-light': NEUTRAL_LIGHT,
};

const THEME_MODES: readonly ThemeMode[] = [
  'purple-dark',
  'purple-light',
  'neutral-dark',
  'neutral-light',
  'auto',
];

// 旧テーマ値（'light' | 'dark'）→ 新テーマ値への移行マップ。
const LEGACY_THEME_MAP: Record<string, ThemeMode> = {
  dark: 'purple-dark',
  light: 'purple-light',
};

/**
 * 保存値・URL クエリ値を `ThemeMode` に正規化する。旧値（'light'/'dark'）は
 * パープル系へ移行する。未知の値は `null`（呼び出し側で既定へフォールバック）。
 */
export function normalizeThemeMode(raw: string | null): ThemeMode | null {
  if (raw === null) return null;
  if ((THEME_MODES as readonly string[]).includes(raw)) {
    return raw as ThemeMode;
  }
  return LEGACY_THEME_MAP[raw] ?? null;
}

/**
 * 選択テーマ（`auto` を含む）を実際に適用する `ResolvedTheme` に解決する。
 * `auto` は OS の prefers-color-scheme に追従し、パープル系（既定ファミリ）へ落とす。
 */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'auto') {
    return prefersDark ? 'purple-dark' : 'purple-light';
  }
  return mode;
}
