import { describe, expect, it } from 'vitest';
import { NOSSKEY_APPS } from './nosskey-apps.js';

describe('NOSSKEY_APPS', () => {
  it('id が重複しない', () => {
    const ids = NOSSKEY_APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('アプリ・ソースコード・作者プロフィールの URL はすべて https', () => {
    for (const app of NOSSKEY_APPS) {
      expect(new URL(app.url).protocol).toBe('https:');
      for (const linkUrl of [app.repositoryUrl, app.authorUrl]) {
        if (linkUrl !== undefined) {
          expect(new URL(linkUrl).protocol).toBe('https:');
        }
      }
    }
  });

  it('ソースコードか作者プロフィールのどちらか一方のリンクを持つ', () => {
    for (const app of NOSSKEY_APPS) {
      expect([app.repositoryUrl, app.authorUrl].filter(Boolean)).toHaveLength(1);
    }
  });

  it('アイコン画像が設定されている', () => {
    for (const app of NOSSKEY_APPS) {
      expect(app.icon).toBeTruthy();
    }
  });
});
