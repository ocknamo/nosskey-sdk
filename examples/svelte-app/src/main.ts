import { createConsoleViewer } from 'console-daijin';
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

// 開発時のみ画面上にコンソールログを表示する
if (import.meta.env.DEV) {
  createConsoleViewer({ show: 'always', height: 160 });
}

const app = mount(App, {
  target: document.getElementById('app') as unknown as HTMLElement,
});

export default app;
