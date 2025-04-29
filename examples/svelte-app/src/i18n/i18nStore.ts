import { derived, writable } from 'svelte/store';
import type { I18nStore, Language, TranslationData } from './translations.js';
import { en, ja } from './translations.js';

// デフォルト言語（日本語）と翻訳データ
const DEFAULT_LANGUAGE: Language = 'ja';

// 利用可能な言語のマップ
const translations: Record<Language, TranslationData> = {
  ja,
  en,
};

// 現在の言語を管理するストア
export const currentLanguage = writable<Language>(loadLanguage());

// 言語変更時にローカルストレージに保存
currentLanguage.subscribe((lang) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nosskey_language', lang);
  }
});

// 言語設定をローカルストレージから読み込む
function loadLanguage(): Language {
  if (typeof window !== 'undefined') {
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

// 現在の言語に基づいた翻訳データを提供するストア
export const i18n = derived<typeof currentLanguage, I18nStore>(
  currentLanguage,
  ($currentLanguage) => ({
    currentLanguage: $currentLanguage,
    t: translations[$currentLanguage],
  })
);
