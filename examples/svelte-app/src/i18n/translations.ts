/**
 * 多言語対応のための翻訳ファイル。
 *
 * 型定義・各言語データは肥大化したため `translations/` 配下へ分割した。
 * このファイルは互換性のためのバレル（再エクスポート）で、import パスは従来どおり。
 */
export type { I18nStore, Language, TranslationData } from './translations/types.js';
export { ja } from './translations/ja.js';
export { en } from './translations/en.js';
