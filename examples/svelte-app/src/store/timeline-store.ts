import { writable } from 'svelte/store';
import { npubToHex } from '../utils/bech32-converter.js';

// タイムラインモード型
export type TimelineMode = 'global' | 'user';

// グローバルTLのソースとなる固定アカウント（複数指定）
export const GLOBAL_FEED_SOURCES: string[] = [
  'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
  'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
  'npub1pp79ruvjd7xned8lgh6n4rhz4pg3els3x5n6kr58l8zcyysp5c0qrkan2p',
];

// npub形式からhex形式に変換したソース配列
export const GLOBAL_FEED_SOURCES_HEX: string[] = GLOBAL_FEED_SOURCES.map((npub) => {
  const hex = npubToHex(npub);
  if (!hex) {
    console.error(`Invalid npub format: ${npub}`);
    return '';
  }
  return hex;
}).filter((hex) => hex !== '');

// タイムラインの表示モード（アプリ全体で共有）
export const timelineMode = writable<TimelineMode>('global');

// タイムラインモード設定関数
export function setTimelineMode(mode: TimelineMode) {
  timelineMode.set(mode);
}

// フォローリストのキャッシュ（pubkeyをキーにした辞書）
export const followListCache = writable<Record<string, string[]>>({});

// タイムラインイベントのキャッシュ（モードとpubkeyをキーにした辞書）
export const timelineEventsCache = writable<Record<string, unknown[]>>({});

// キャッシュキーの生成
export function createCacheKey(mode: TimelineMode, pubkey: string): string {
  return `${mode}:${pubkey}`;
}
