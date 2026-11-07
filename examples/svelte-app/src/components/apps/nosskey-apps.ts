// Nosskey（nosskey-iframe 経由）でログインできるアプリの一覧。紹介画面（AppsScreen）で表示する。
// アプリ名は固有名なので翻訳しない。説明文は `$i18n.t.apps.descriptions[descriptionKey]` で引く。
import CombineIcon from '../../assets/apps/combine.png';
import NosqueradeIcon from '../../assets/apps/nosquerade.png';
import XIsDownIcon from '../../assets/apps/x-is-down.svg';
import YakitofuIcon from '../../assets/apps/yakitofu.png';
import type { TranslationData } from '../../i18n/translations/types.js';

export type AppDescriptionKey = keyof TranslationData['apps']['descriptions'];

export interface NosskeyApp {
  id: string;
  name: string;
  url: string;
  // ソースコードの公開リポジトリ。あればカードに GitHub アイコンのリンクを出す。
  repositoryUrl?: string;
  // リポジトリが非公開のアプリは、代わりに作者の Nostr プロフィール（njump など）へのリンクを出す。
  // repositoryUrl と authorUrl のどちらか一方は必ず設定する（nosskey-apps.spec.ts で検証）。
  authorUrl?: string;
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
  {
    id: 'nosquerade',
    name: 'nosquerade',
    url: 'https://nosquerade.haniwar.com/',
    authorUrl:
      'https://njump.to/nprofile1qqs0pz5nwppytqqa0e0xxalc0r5u863dlhm5r8wgnm709dwh5hmz0kgprdmhxue69uhhyetvv9uj66ns9e5xzmnfwashytnrdakj7qgcwaehxw309ahx7um5wghxjar5v9hx6mewd4jkutcppemhxue69uhhjctzw5hx6ef0ujmqjx',
    icon: NosqueradeIcon,
    descriptionKey: 'nosquerade',
  },
];
