import { writable } from 'svelte/store';

/**
 * Nosskey インスタンスを保持するストア
 */
export const nosskeyInstance = writable(null);

/**
 * 導出された鍵情報を保持するストア
 */
export const derivedKey = writable(null);

/**
 * ユーザーIDを保持するストア
 */
export const userId = writable('');

/**
 * 認証状態を保持するストア
 * @type {import('svelte/store').Writable<boolean>}
 */
export const isAuthenticated = writable(false);
