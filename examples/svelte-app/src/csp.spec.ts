import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY } from './csp.js';

describe('CONTENT_SECURITY_POLICY', () => {
  it('includes the directives required for the app to function', () => {
    // 必須ディレクティブが揃っていること（欠けると機能が無言で壊れるため回帰防止）。
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    // 任意リレーへの WebSocket。
    expect(CONTENT_SECURITY_POLICY).toContain('connect-src');
    expect(CONTENT_SECURITY_POLICY).toContain('wss:');
    // オープン埋め込みモデル（任意の親が署名 iframe を埋め込める）。
    expect(CONTENT_SECURITY_POLICY).toContain('frame-ancestors *');
  });

  it('does not allow inline scripts (the core XSS defense)', () => {
    // script-src に 'unsafe-inline' / 'unsafe-eval' を許すと多層防御が無効化する。
    const scriptSrc = CONTENT_SECURITY_POLICY.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it('stays in sync with public/_headers (single source of truth)', () => {
    // 本番（Cloudflare Pages）配信用の _headers と dev/preview の vite プラグインが
    // 同じポリシーを使うことを保証する。乖離するとデプロイ後に初めて壊れる。
    // vitest は svelte-app をカレントに実行されるため cwd 起点で解決する
    // （happy-dom 環境では import.meta.url が file スキームにならないため）。
    const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');
    const cspLine = headers
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('Content-Security-Policy:'));
    expect(cspLine).toBeDefined();
    // 部分一致ではなく値を厳密一致させ、_headers 側への行末追記による乖離も検出する。
    const value = cspLine?.slice('Content-Security-Policy:'.length).trim();
    expect(value).toBe(CONTENT_SECURITY_POLICY);
  });
});
