import { derived, writable } from 'svelte/store';
import type {
  DeepPartial,
  I18nStore,
  Language,
  TermMode,
  TranslationData,
} from './translations.js';
import { en, ja, simpleEn, simpleJa } from './translations.js';

// デフォルト言語（日本語）と翻訳データ
const DEFAULT_LANGUAGE: Language = 'ja';

// 利用可能な言語のマップ
const translations: Record<Language, TranslationData> = {
  ja,
  en,
};

// シンプルモード（専門用語の置き換え）の部分オーバーレイ
const simpleOverlays: Record<Language, DeepPartial<TranslationData>> = {
  ja: simpleJa,
  en: simpleEn,
};

// 用語表示モードのデフォルトはシンプル（一般ユーザー向け）
const DEFAULT_TERM_MODE: TermMode = 'simple';
export const TERM_MODE_STORAGE_KEY = 'nosskey_term_mode';

// 親オリジンから `?embedded=1&lang=...` で言語を上書きされた場合、
// localStorage には書き戻さない（次回スタンドアロン起動時に保持するため）。
let embeddedLangOverride = false;

// 現在の言語を管理するストア
export const currentLanguage = writable<Language>(loadLanguage());

// 言語変更時にローカルストレージに保存
currentLanguage.subscribe((lang) => {
  if (embeddedLangOverride) return;
  if (typeof window !== 'undefined') {
    localStorage.setItem('nosskey_language', lang);
  }
});

// 言語設定をローカルストレージから読み込む
function loadLanguage(): Language {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embedded') === '1') {
      const l = params.get('lang');
      if (l === 'ja' || l === 'en') {
        embeddedLangOverride = true;
        return l;
      }
      if (l === 'auto') {
        // 親が `auto` を指定したらブラウザ言語で解決し、上書きフラグは立てる
        // （次回スタンドアロン起動時の localStorage 書き戻しを抑止するため）。
        embeddedLangOverride = true;
        const browserLang = navigator.language.split('-')[0];
        return browserLang === 'ja' ? 'ja' : 'en';
      }
    }

    const saved = localStorage.getItem('nosskey_language');
    if (saved && (saved === 'ja' || saved === 'en')) {
      return saved;
    }

    // ブラウザの言語設定に基づいてデフォルト言語を決定（英語・日本語のみサポート）
    const browserLang = navigator.language.split('-')[0];

    return browserLang === 'ja' ? 'ja' : 'en';
  }

  return DEFAULT_LANGUAGE;
}

// 言語を変更する関数
export function changeLanguage(lang: Language): void {
  currentLanguage.set(lang);
}

// 用語表示モードをローカルストレージから読み込む（未保存時はシンプルモード）
function loadTermMode(): TermMode {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(TERM_MODE_STORAGE_KEY);
    if (saved === 'simple' || saved === 'standard') {
      return saved;
    }
  }
  return DEFAULT_TERM_MODE;
}

// 現在の用語表示モードを管理するストア
export const termMode = writable<TermMode>(loadTermMode());

// モード変更時にローカルストレージに保存
termMode.subscribe((mode) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TERM_MODE_STORAGE_KEY, mode);
  }
});

// 用語表示モードを変更する関数
export function changeTermMode(mode: TermMode): void {
  termMode.set(mode);
}

// オーバーレイに定義されたキーだけを上書きする deep merge。
// オーバーレイ側に無いキーは base（標準文言）がそのまま残る。
function deepMerge<T extends object>(base: T, overlay: DeepPartial<T>): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    const baseValue = result[key];
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof baseValue === 'object' &&
      baseValue !== null
    ) {
      result[key] = deepMerge(baseValue as object, value as DeepPartial<object>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// derived は言語/モードが変わったときだけ再計算し、結果も derived 側でメモ化される。
// deepMerge はオーバーレイのキー数（数十）を走査するだけの軽処理なので、
// 切替のたびに毎回マージして問題ない（キャッシュは不要）。
function resolveTranslation(lang: Language, mode: TermMode): TranslationData {
  if (mode === 'standard') return translations[lang];
  return deepMerge(translations[lang], simpleOverlays[lang]);
}

// 現在の言語と用語表示モードに基づいた翻訳データを提供するストア
export const i18n = derived<[typeof currentLanguage, typeof termMode], I18nStore>(
  [currentLanguage, termMode],
  ([$currentLanguage, $termMode]) => ({
    currentLanguage: $currentLanguage,
    termMode: $termMode,
    t: resolveTranslation($currentLanguage, $termMode),
  })
);
