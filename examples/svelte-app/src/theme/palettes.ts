// テーマ定義。`App.svelte` の `applyTheme()` が選択テーマを解決し、対応する
// パレット（CSS custom properties のマップ）を `document.documentElement` に適用する。
//
// 設計メモ:
// - `ThemeMode` はユーザーが選択・永続化する値（4 カラーテーマ + `auto`）。
// - `ResolvedTheme` は実際に適用される 4 テーマ。`auto` は OS の prefers-color-scheme で
//   パープル系（既定ファミリ）の dark/light に解決される。
// - ニュートラル系は dark/light をベースにアクセント（primary 系）と面の色味をグレー無彩色へ置換。
//   status 色（success/warning/error/info）は意味色のため据え置く。

export type ThemeMode = 'purple-dark' | 'purple-light' | 'neutral-dark' | 'neutral-light' | 'auto';

export type ResolvedTheme = 'purple-dark' | 'purple-light' | 'neutral-dark' | 'neutral-light';

// フォントスタック。パープル系は従来のシステムフォント、ニュートラル系は丸ゴシック
// （M PLUS Rounded 1c を Google Fonts から読み込み、未ロード時はシステムへフォールバック）。
const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';
const ROUNDED_FONT_STACK = `"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", ${SYSTEM_FONT_STACK}`;

// パープルダーク（旧 'dark'）。わずかに紫みを帯びたダークグレーを基調に、
// アクセントは明るめのバイオレット、塗りボタンは白文字のコントラストを確保した濃いめのバイオレット。
const PURPLE_DARK: Record<string, string> = {
  '--color-text': '#E9E9F0',
  '--color-titles': '#FAFAFC',
  '--color-primary': '#A78BFA',
  '--color-secondary': '#C4B5FD',
  '--color-tertiary': '#22222B',
  '--color-border': '#26262F',
  '--color-card': '#131318',
  '--color-background': '#0A0A0D',
  '--color-text-secondary': '#A1A1AE',
  '--color-text-on-primary': '#FFFFFF',

  // 状態色（ダーク）
  '--color-success': '#4ADE80',
  '--color-warning': '#FBBF24',
  '--color-error': '#F87171',
  '--color-info': '#60A5FA',

  // 背景色バリエーション（ダーク）
  '--color-surface': '#18181F',
  '--color-overlay': '#1F1F27',

  // テキスト色バリエーション（ダーク）
  '--color-text-primary': '#FAFAFC',
  '--color-text-disabled': '#5F5F6B',
  '--color-text-muted': '#9A9AA8',
  '--color-text-dark': '#D4D4DE',

  // ボーダー色バリエーション（ダーク）
  '--color-border-strong': '#3A3A46',
  '--color-border-light': '#2A2A33',
  '--color-border-medium': '#4A4A55',

  // ボタン色（ダーク）
  // 白文字とのコントラスト比 4.5 以上を確保する濃さ（#7C3AED は 5.7:1）。
  '--color-button-primary': '#7C3AED',
  '--color-button-secondary': '#24242D',
  '--color-button-success': '#15803D',
  '--color-button-warning': '#FBBF24',
  '--color-button-danger': '#DC2626',
  '--color-button-info': '#3B82F6',
  // 塗りボタン（primary 以外の面ボタン）の文字色。
  '--color-button-secondary-text': '#E9E9F0',
  // primary ボタンの色付きシャドウ。ニュートラル系は影なし方針のため transparent。
  '--color-primary-glow': 'rgba(124, 58, 237, 0.18)',

  // ボタンホバー色（ダーク）
  '--color-button-primary-hover': '#6D28D9',
  '--color-button-secondary-hover': '#2E2E39',
  '--color-button-success-hover': '#166534',
  '--color-button-danger-hover': '#B91C1C',
  '--color-button-info-hover': '#60A5FA',

  // ボタン無効化色（ダーク）
  '--color-button-disabled': '#2A2A33',
  '--color-button-danger-disabled': '#4A2328',

  // 透明度付き色（ダーク）
  '--color-primary-alpha-20': 'rgba(167, 139, 250, 0.2)',
  '--color-primary-alpha-08': 'rgba(167, 139, 250, 0.08)',
  '--color-shadow': 'rgba(0, 0, 0, 0.35)',
  '--color-shadow-strong': 'rgba(0, 0, 0, 0.55)',

  // 特殊背景色（ダーク）
  '--color-success-bg': 'rgba(74, 222, 128, 0.1)',
  '--color-warning-bg': 'rgba(251, 191, 36, 0.1)',
  '--color-error-bg': 'rgba(248, 113, 113, 0.1)',
  '--color-info-bg': 'rgba(96, 165, 250, 0.1)',
  '--color-surface-hover': '#24242D',

  // ボーダー特殊色（ダーク）
  '--color-success-border': 'rgba(74, 222, 128, 0.35)',
  '--color-warning-border': 'rgba(251, 191, 36, 0.35)',
  '--color-error-border': 'rgba(248, 113, 113, 0.35)',
  '--color-info-border': 'rgba(96, 165, 250, 0.35)',

  // アイコンフィルター（ダーク）
  '--icon-filter': 'invert(1) brightness(1)',

  // primary 色へ着色する SVG アイコン用フィルター（アクティブな nav アイコン等）。
  // 黒 SVG をパープルアクセント (#A78BFA 相当) へ変換する。
  '--icon-filter-primary':
    'brightness(0) saturate(100%) invert(62%) sepia(48%) saturate(2400%) hue-rotate(218deg) brightness(101%) contrast(96%)',

  // ボーダー幅（ダーク）。カード・フレーム類で使う。ニュートラル系はこれを太くして差別化する。
  '--border-width': '1px',

  // フォント（ダーク）。ニュートラル系で丸ゴシックへ差し替える。
  '--font-family': SYSTEM_FONT_STACK,

  // バナーオーバーレイ（ダーク）
  '--banner-overlay-gradient':
    'linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.3) 100%)',
};

// パープルライト（旧 'light'）。ごく淡いラベンダーグレーの背景に白カード、バイオレットのアクセント。
const PURPLE_LIGHT: Record<string, string> = {
  '--color-text': '#3F3F4E',
  '--color-titles': '#14141F',
  '--color-primary': '#6E56CF',
  '--color-secondary': '#4C3BA8',
  '--color-tertiary': '#F5F3FF',
  '--color-border': '#E6E6EE',
  '--color-card': '#FFFFFF',
  '--color-background': '#F5F5F9',
  '--color-text-secondary': '#6B6B7B',
  '--color-text-on-primary': '#FFFFFF',

  // 状態色（ライト）
  '--color-success': '#15803D',
  '--color-warning': '#B45309',
  '--color-error': '#DC2626',
  '--color-info': '#2563EB',

  // 背景色バリエーション（ライト）
  '--color-surface': '#F7F7FA',
  '--color-overlay': '#F3F3F7',

  // テキスト色バリエーション（ライト）
  '--color-text-primary': '#14141F',
  '--color-text-disabled': '#A1A1AE',
  '--color-text-muted': '#6B6B7B',
  '--color-text-dark': '#2B2B36',

  // ボーダー色バリエーション（ライト）
  '--color-border-strong': '#D6D6E0',
  '--color-border-light': '#ECECF2',
  '--color-border-medium': '#D6D6E0',

  // ボタン色（ライト）
  '--color-button-primary': '#6E56CF',
  '--color-button-secondary': '#EEEEF3',
  '--color-button-success': '#15803D',
  '--color-button-warning': '#D97706',
  '--color-button-danger': '#DC2626',
  '--color-button-info': '#2563EB',
  // 塗りボタン（primary 以外の面ボタン）の文字色。
  '--color-button-secondary-text': '#2B2B36',
  // primary ボタンの色付きシャドウ。ニュートラル系は影なし方針のため transparent。
  '--color-primary-glow': 'rgba(110, 86, 207, 0.16)',

  // ボタンホバー色（ライト）
  '--color-button-primary-hover': '#5B46B8',
  '--color-button-secondary-hover': '#E4E4EB',
  '--color-button-success-hover': '#166534',
  '--color-button-danger-hover': '#B91C1C',
  '--color-button-info-hover': '#1D4ED8',

  // ボタン無効化色（ライト）
  '--color-button-disabled': '#D6D6E0',
  '--color-button-danger-disabled': '#F3B4B4',

  // 透明度付き色（ライト）
  '--color-primary-alpha-20': 'rgba(110, 86, 207, 0.18)',
  '--color-primary-alpha-08': 'rgba(110, 86, 207, 0.07)',
  '--color-shadow': 'rgba(20, 20, 40, 0.06)',
  '--color-shadow-strong': 'rgba(20, 20, 40, 0.14)',

  // 特殊背景色（ライト）
  '--color-success-bg': '#ECFDF3',
  '--color-warning-bg': '#FFF8EB',
  '--color-error-bg': '#FEF2F2',
  '--color-info-bg': '#EFF6FF',
  '--color-surface-hover': '#EFEFF4',

  // ボーダー特殊色（ライト）
  '--color-success-border': '#A7E3BD',
  '--color-warning-border': '#F8D8A0',
  '--color-error-border': '#F5B5B5',
  '--color-info-border': '#BCD4FB',

  // アイコンフィルター（ライト）
  '--icon-filter': 'none',

  // primary 色へ着色する SVG アイコン用フィルター（アクティブな nav アイコン等）。
  // 黒 SVG をパープルアクセント (#6E56CF 相当) へ変換する。
  '--icon-filter-primary':
    'brightness(0) saturate(100%) invert(36%) sepia(62%) saturate(1900%) hue-rotate(236deg) brightness(88%) contrast(90%)',

  // ボーダー幅（ライト）。カード・フレーム類で使う。ニュートラル系はこれを太くして差別化する。
  '--border-width': '1px',

  // フォント（ライト）。ニュートラル系で丸ゴシックへ差し替える。
  '--font-family': SYSTEM_FONT_STACK,

  // バナーオーバーレイ（ライト）
  '--banner-overlay-gradient':
    'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.5) 100%)',
};

// ニュートラルダーク。パープルダークをベースに primary 系アクセントと面の色味をグレー無彩色へ置換。
const NEUTRAL_DARK: Record<string, string> = {
  ...PURPLE_DARK,
  '--color-primary': '#A0A0A8',
  '--color-secondary': '#C4C4CC',
  '--color-button-primary': '#A0A0A8',
  '--color-button-primary-hover': '#C4C4CC',
  '--color-primary-glow': 'transparent',
  '--color-text-on-primary': '#000000',
  // 塗りボタンの文字が黒（text-on-primary）なので、黒文字で読める明るさの塗りにする。
  '--color-button-success': '#16A34A',
  '--color-button-success-hover': '#22C55E',
  '--color-button-danger': '#E5484D',
  '--color-button-danger-hover': '#EF6B6E',
  '--color-primary-alpha-20': 'rgba(160, 160, 168, 0.2)',
  '--color-primary-alpha-08': 'rgba(160, 160, 168, 0.08)',
  // 面はパープル系の紫みを抜いた純グレーにする。
  '--color-background': '#0A0A0A',
  '--color-card': '#141414',
  '--color-tertiary': '#222222',
  '--color-overlay': '#1F1F1F',
  '--color-surface': '#1A1A1A',
  '--color-surface-hover': '#262626',
  '--color-border-strong': '#3A3A3A',
  '--color-border-light': '#2A2A2A',
  '--color-border-medium': '#4A4A4A',
  '--color-button-secondary': '#262626',
  '--color-button-secondary-hover': '#303030',
  // 黒 SVG を明るいグレー (#A0A0A8 相当) へ着色（hue なし、明度のみ）。
  '--icon-filter-primary': 'brightness(0) saturate(100%) invert(70%)',
  // 差別化: 太いボーダー + 影なし + 丸ゴシック。太線が見えるようカード枠の border 色も強める。
  '--color-border': '#4A4A4E',
  '--border-width': '3px',
  '--color-shadow': 'transparent',
  '--color-shadow-strong': 'transparent',
  '--font-family': ROUNDED_FONT_STACK,
};

// ニュートラルライト。パープルライトをベースに primary 系アクセントと面の色味をグレー無彩色へ置換。
const NEUTRAL_LIGHT: Record<string, string> = {
  ...PURPLE_LIGHT,
  '--color-primary': '#5A5A66',
  '--color-secondary': '#42424D',
  '--color-tertiary': '#F2F2F4',
  '--color-button-primary': '#5A5A66',
  '--color-button-primary-hover': '#42424D',
  '--color-primary-glow': 'transparent',
  '--color-primary-alpha-20': 'rgba(90, 90, 102, 0.2)',
  '--color-primary-alpha-08': 'rgba(90, 90, 102, 0.08)',
  // 面はパープル系の紫みを抜いた純グレーにする。
  '--color-background': '#F5F5F5',
  '--color-surface': '#F7F7F7',
  '--color-overlay': '#F3F3F3',
  '--color-surface-hover': '#EEEEEE',
  '--color-border-strong': '#D6D6D6',
  '--color-border-light': '#ECECEC',
  '--color-border-medium': '#D6D6D6',
  '--color-button-secondary': '#EEEEEE',
  '--color-button-secondary-hover': '#E4E4E4',
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

/**
 * 解決済みテーマが暗色系か。ロゴのようにテーマで画像そのものを差し替えたい箇所向けに、
 * `App.svelte` が `<html data-color-scheme="dark|light">` を設定するのに使う。
 */
export function isDarkTheme(resolved: ResolvedTheme): boolean {
  return resolved === 'purple-dark' || resolved === 'neutral-dark';
}
