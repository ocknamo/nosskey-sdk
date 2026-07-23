// @vitest-environment happy-dom
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ja } from './translations/ja.js';
import { simpleJa } from './translations/simple-ja.js';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  // happy-dom の navigator.language は環境依存（既定は英語）なので、
  // 日本語文言を検証するテストのため言語を明示的に固定する。
  localStorage.setItem('nosskey_language', 'ja');
});

// i18n-store はモジュール読み込み時に localStorage を参照して初期状態を決めるため、
// テストごとに vi.resetModules() + 動的 import で再評価する。
async function importStore() {
  return await import('./i18n-store.js');
}

describe('termMode の初期値', () => {
  it('localStorage 未設定時はシンプルモードがデフォルト', async () => {
    const { termMode } = await importStore();
    expect(get(termMode)).toBe('simple');
  });

  it('保存済みの standard を復元する', async () => {
    localStorage.setItem('nosskey_term_mode', 'standard');
    const { termMode } = await importStore();
    expect(get(termMode)).toBe('standard');
  });

  it('不正な保存値はシンプルモードにフォールバックする', async () => {
    localStorage.setItem('nosskey_term_mode', 'bogus');
    const { termMode } = await importStore();
    expect(get(termMode)).toBe('simple');
  });
});

describe('i18n の翻訳解決', () => {
  it('シンプルモードではオーバーレイのキーが置換される', async () => {
    const { i18n } = await importStore();
    const t = get(i18n).t;
    expect(t.nostr.publicKey).toBe(simpleJa.nostr?.publicKey);
    expect(t.nostr.publicKey).toBe('ユーザーID');
    expect(t.consent.methodLabel.signEvent).toBe('投稿の承認');
  });

  it('オーバーレイに無いキーは標準文言にフォールバックする', async () => {
    const { i18n } = await importStore();
    const t = get(i18n).t;
    // copyToClipboard は simpleJa に定義していないため ja.ts の値が残る
    expect(t.nostr.copyToClipboard).toBe(ja.nostr.copyToClipboard);
    expect(t.common.save).toBe(ja.common.save);
  });

  it('standard モードでは常に元の標準文言を返す', async () => {
    localStorage.setItem('nosskey_term_mode', 'standard');
    const { i18n } = await importStore();
    const t = get(i18n).t;
    expect(t.nostr.publicKey).toBe(ja.nostr.publicKey);
    expect(t.nostr.publicKey).toBe('公開鍵');
  });
});

describe('changeTermMode', () => {
  it('モードを切り替えると翻訳と localStorage が更新される', async () => {
    const { i18n, changeTermMode } = await importStore();
    expect(get(i18n).t.nostr.publicKey).toBe('ユーザーID');

    changeTermMode('standard');
    expect(get(i18n).t.nostr.publicKey).toBe('公開鍵');
    expect(get(i18n).termMode).toBe('standard');
    expect(localStorage.getItem('nosskey_term_mode')).toBe('standard');

    changeTermMode('simple');
    expect(get(i18n).t.nostr.publicKey).toBe('ユーザーID');
    expect(localStorage.getItem('nosskey_term_mode')).toBe('simple');
  });
});
