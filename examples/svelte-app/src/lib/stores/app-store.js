import { writable } from 'svelte/store';

// アプリの画面状態
export const currentView = writable('home');

// 画面遷移関数
export function navigateTo(view) {
  currentView.set(view);
}
