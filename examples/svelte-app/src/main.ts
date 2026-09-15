import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { logStorageDiagnostics, startDebugConsole } from './debug/debug-console.js';

// `?debug=1` のときだけオンページコンソールを起動する。フラグが無ければ即 return し、
// console-daijin 本体（別チャンク）は取得もされない。
//
// `mount()` の**前に await する**のが要点。console-daijin は起動した時点以降の
// console しか拾わないため、ここで待たないとアプリ初期化中のログ（iframe の
// Storage Access 判定など、この調査で一番見たいもの）がパネルに残らない。
await startDebugConsole();
logStorageDiagnostics('boot');

const app = mount(App, {
  target: document.getElementById('app') as unknown as HTMLElement,
});

export default app;
