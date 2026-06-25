import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NosskeyIframeClient } from './client.js';
import { createHarness } from './client.test-helpers.js';
import type { Harness } from './client.test-helpers.js';

describe('NosskeyIframeClient', () => {
  let harness: Harness;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts an iframe with the WebAuthn allow attribute and hidden style', () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });

    expect(harness.iframes).toHaveLength(1);
    const iframe = harness.iframes[0];
    expect(iframe.src).toBe('https://nosskey.example/iframe');
    expect(iframe.getAttribute('allow')).toBe(
      'publickey-credentials-get; publickey-credentials-create'
    );
    expect(iframe.style.display).toBe('none');
    expect(iframe.parentNode).toBe(harness.container);
    client.destroy();
  });

  it('appends embedded=1 and theme/lang query params when provided', () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/#/iframe',
      theme: 'dark',
      lang: 'ja',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });

    const iframe = harness.iframes[0];
    const url = new URL(iframe.src);
    expect(url.searchParams.get('embedded')).toBe('1');
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.searchParams.get('lang')).toBe('ja');
    expect(url.hash).toBe('#/iframe');
    client.destroy();
  });

  it('omits theme/lang params when neither option is supplied', () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/#/iframe',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });

    const iframe = harness.iframes[0];
    expect(iframe.src).toBe('https://nosskey.example/#/iframe');
    client.destroy();
  });

  it('appends only theme when lang is omitted (and vice versa)', () => {
    const themeOnly = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/#/iframe',
      theme: 'auto',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    const themeIframe = harness.iframes[0];
    const themeUrl = new URL(themeIframe.src);
    expect(themeUrl.searchParams.get('embedded')).toBe('1');
    expect(themeUrl.searchParams.get('theme')).toBe('auto');
    expect(themeUrl.searchParams.has('lang')).toBe(false);
    themeOnly.destroy();

    const langOnly = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/#/iframe',
      lang: 'en',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });
    const langIframe = harness.iframes[1];
    const langUrl = new URL(langIframe.src);
    expect(langUrl.searchParams.get('embedded')).toBe('1');
    expect(langUrl.searchParams.get('lang')).toBe('en');
    expect(langUrl.searchParams.has('theme')).toBe(false);
    langOnly.destroy();
  });

  it('overrides existing embedded/theme/lang query params on the source URL', () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/iframe?embedded=1&theme=light&lang=en',
      theme: 'dark',
      lang: 'ja',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });

    const iframe = harness.iframes[0];
    const url = new URL(iframe.src);
    expect(url.searchParams.getAll('theme')).toEqual(['dark']);
    expect(url.searchParams.getAll('lang')).toEqual(['ja']);
    expect(url.searchParams.getAll('embedded')).toEqual(['1']);
    client.destroy();
  });

  it('resolves a relative iframeUrl against window.location.href', () => {
    const client = new NosskeyIframeClient({
      iframeUrl: '/iframe',
      theme: 'dark',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });

    const iframe = harness.iframes[0];
    // Harness location.href is 'https://parent.example/app/' so '/iframe'
    // resolves under the same origin.
    const url = new URL(iframe.src);
    expect(url.origin).toBe('https://parent.example');
    expect(url.pathname).toBe('/iframe');
    expect(url.searchParams.get('embedded')).toBe('1');
    expect(url.searchParams.get('theme')).toBe('dark');
    client.destroy();
  });

  it("passes lang='auto' through to the iframe unchanged", () => {
    const client = new NosskeyIframeClient({
      iframeUrl: 'https://nosskey.example/#/iframe',
      lang: 'auto',
      window: harness.window,
      document: harness.document,
      container: harness.container as unknown as HTMLElement,
    });

    const iframe = harness.iframes[0];
    const url = new URL(iframe.src);
    expect(url.searchParams.get('embedded')).toBe('1');
    expect(url.searchParams.get('lang')).toBe('auto');
    client.destroy();
  });
});
