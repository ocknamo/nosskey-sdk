// Nosskey（nosskey-iframe 経由）でログインできるアプリの一覧。紹介画面（AppsScreen）で表示する。
// アプリ名は固有名なので翻訳しない。説明文は `$i18n.t.apps.descriptions[descriptionKey]` で引く。
import CombineIcon from '../../assets/apps/combine.png';
import XIsDownIcon from '../../assets/apps/x-is-down.png';
import YakitofuIcon from '../../assets/apps/yakitofu.png';
import type { TranslationData } from '../../i18n/translations/types.js';

export type AppDescriptionKey = keyof TranslationData['apps']['descriptions'];

export interface NosskeyApp {
  id: string;
  name: string;
  url: string;
  repositoryUrl: string;
  icon: string;
  descriptionKey: AppDescriptionKey;
}

export const NOSSKEY_APPS: readonly NosskeyApp[] = [
  {
    id: 'combine',
    name: 'combine',
    url: 'https://ocknamo.github.io/combine/',
    repositoryUrl: 'https://github.com/ocknamo/combine',
    icon: CombineIcon,
    descriptionKey: 'combine',
  },
  {
    id: 'yakitofu',
    name: 'Yakitofu',
    url: 'https://yakitofu.org/',
    repositoryUrl: 'https://github.com/ocknamo/yakitofu',
    icon: YakitofuIcon,
    descriptionKey: 'yakitofu',
  },
  {
    id: 'x-is-down',
    name: 'X落ちてる速報',
    url: 'https://ocknamo.github.io/x-is-down/',
    repositoryUrl: 'https://github.com/ocknamo/x-is-down',
    icon: XIsDownIcon,
    descriptionKey: 'xIsDown',
  },
];
