// グローバル型定義
/// <reference types="@sveltejs/kit" />

// 翻訳データの型
interface TranslationData {
  [key: string]: string;
}

// インポート可能なモジュールとしてi18nを宣言
declare module '*/i18n/*.js' {
  export const t: import('svelte/store').Readable<(key: string) => string>;
  export const language: import('svelte/store').Readable<string>;
  export function setLanguage(lang: string): void;
  export function initLanguage(): void;
  export const languages: string[];
}

// グローバルなt関数をAmbient宣言
declare namespace App {
  interface Locals {
    t: (key: string) => string;
  }

  interface Platform {
    env: {
      COUNTER: DurableObjectNamespace;
    };
    context: {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      waitUntil(promise: Promise<any>): void;
    };
    caches: CacheStorage & { default: Cache };
  }
}

// SvelteKitのグローバル型拡張
declare namespace svelte.JSX {
  interface HTMLAttributes<T> {
    // svelte-headなどのディレクティブ用
    'on:click_outside'?: (event: CustomEvent<any>) => void;
  }
}
