import { browser } from '$app/environment';
import { derived, writable } from 'svelte/store';

import en from './en.js';
// 翻訳データをインポート
import ja from './ja.js';

// 利用可能な言語
export const languages = ['ja', 'en'];

// 翻訳データ
const translations = {
  ja,
  en,
};

// ブラウザの言語を取得する関数
function getBrowserLanguage() {
  if (!browser) return 'ja'; // SSRの場合はデフォルト言語を返す

  const userLang = navigator.language || navigator.userLanguage;
  return userLang.startsWith('ja') ? 'ja' : 'en'; // 日本語ならja、それ以外はen
}

// 現在の言語を保持するストア
export const language = writable(getBrowserLanguage());

// 翻訳関数を提供するderived store
export const t = derived(language, ($language) => (key) => {
  // 現在の言語の翻訳データからキーに対応する翻訳を取得
  const lang = translations[$language] || translations.en;
  // 型安全のため、キーが存在するか確認してから返す
  return lang[key] !== undefined ? lang[key] : key; // 翻訳がない場合はキーをそのまま返す
});

// 言語を切り替える関数
export function setLanguage(newLang) {
  if (languages.includes(newLang)) {
    language.set(newLang);
    if (browser) {
      localStorage.setItem('preferredLanguage', newLang); // 言語設定を保存
    }
  }
}

// ブラウザのlocalStorageから言語設定を復元
export function initLanguage() {
  if (browser) {
    const savedLang = localStorage.getItem('preferredLanguage');
    if (savedLang && languages.includes(savedLang)) {
      language.set(savedLang);
    } else {
      language.set(getBrowserLanguage());
    }
  }
}
