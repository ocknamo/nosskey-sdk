import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { Nosskey } from 'nosskey-sdk';

/**
 * 導出された鍵情報の型定義
 */
export interface DerivedKey {
  pk: Uint8Array;
  sk: Uint8Array;
}

/**
 * Nosskey インスタンスを保持するストア
 * @type {Writable<Nosskey | null>}
 */
export const nosskeyInstance: Writable<Nosskey | null> = writable(null);

/**
 * 導出された鍵情報を保持するストア
 * @type {Writable<DerivedKey | null>}
 */
export const derivedKey: Writable<DerivedKey | null> = writable(null);

/**
 * ユーザーIDを保持するストア
 * @type {Writable<string>}
 */
export const userId: Writable<string> = writable('');

/**
 * 認証状態を保持するストア
 * @type {Writable<boolean>}
 */
export const isAuthenticated: Writable<boolean> = writable(false);
