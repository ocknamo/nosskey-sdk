import { describe, expect, it } from 'vitest';
import { isLikelyWebKit } from './user-agent.js';

const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';
const IOS_EDGE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/130.0.0.0 Mobile/15E148 Safari/604.1';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const DESKTOP_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
// アプリ内ブラウザ (WKWebView) は "Safari" トークンを持たない。
const IOS_IN_APP_WEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

describe('isLikelyWebKit', () => {
  it('accepts every iOS browser, which all run on WebKit', () => {
    expect(isLikelyWebKit(IOS_SAFARI)).toBe(true);
    expect(isLikelyWebKit(IOS_CHROME)).toBe(true);
    expect(isLikelyWebKit(IOS_EDGE)).toBe(true);
    expect(isLikelyWebKit(MAC_SAFARI)).toBe(true);
  });

  it('rejects Chromium browsers that also carry a Safari token', () => {
    expect(isLikelyWebKit(ANDROID_CHROME)).toBe(false);
    expect(isLikelyWebKit(DESKTOP_EDGE)).toBe(false);
  });

  it('returns false for an empty user agent', () => {
    expect(isLikelyWebKit('')).toBe(false);
  });

  // 既知の限界を回帰として固定する。実機調査でアプリ内ブラウザが対象になった
  // 場合、cookie フォールバックに入らない原因がここであることを示すため。
  it('misses a WKWebView in-app browser (documented limitation)', () => {
    expect(isLikelyWebKit(IOS_IN_APP_WEBVIEW)).toBe(false);
  });
});
