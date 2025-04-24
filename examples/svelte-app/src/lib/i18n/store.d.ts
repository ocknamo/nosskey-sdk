import type { Readable } from 'svelte/store';

// 型定義ファイル
export const language: Readable<string>;
export const t: Readable<(key: string) => string>;
export function setLanguage(lang: string): void;
export function initLanguage(): void;
export const languages: string[];
