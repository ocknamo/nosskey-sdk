/**
 * 多言語対応のための翻訳ファイル。
 *
 * 型定義・各言語データは肥大化したため `translations/` 配下へ分割した。
 * このファイルは互換性のためのバレル（再エクスポート）で、import パスは従来どおり。
 */

export { en } from './translations/en.js';
export { ja } from './translations/ja.js';
export { simpleEn } from './translations/simple-en.js';
export { simpleJa } from './translations/simple-ja.js';
export type {
  DeepPartial,
  I18nStore,
  Language,
  TermMode,
  TranslationData,
} from './translations/types.js';
