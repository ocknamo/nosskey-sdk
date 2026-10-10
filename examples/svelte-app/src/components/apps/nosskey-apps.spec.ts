import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/translations/en.js';
import { ja } from '../../i18n/translations/ja.js';
import { NOSSKEY_APPS } from './nosskey-apps.js';

describe('NOSSKEY_APPS', () => {
  it('id が重複しない', () => {
    const ids = NOSSKEY_APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('アプリとソースコードの URL はすべて https', () => {
    for (const app of NOSSKEY_APPS) {
      expect(new URL(app.url).protocol).toBe('https:');
      expect(new URL(app.repositoryUrl).protocol).toBe('https:');
    }
  });

  it('説明文が日本語・英語の両方に用意されている', () => {
    for (const app of NOSSKEY_APPS) {
      expect(ja.apps.descriptions[app.descriptionKey]).toBeTruthy();
      expect(en.apps.descriptions[app.descriptionKey]).toBeTruthy();
    }
  });

  it('アイコン画像が設定されている', () => {
    for (const app of NOSSKEY_APPS) {
      expect(app.icon).toBeTruthy();
    }
  });
});
