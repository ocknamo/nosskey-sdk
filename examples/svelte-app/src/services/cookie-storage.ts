/**
 * `Storage` 互換の cookie ラッパー。SDK の `NosskeyManager` は `getItem` /
 * `setItem` / `removeItem` の 3 メソッドしか呼ばないため、それ以外は最小実装。
 *
 * 目的: iOS Safari (WebKit) のクロスオリジン iframe では `localStorage` が
 * Storage Access API のグラント後も partition されたままだが、cookie は
 * unpartition される。NostrKeyInfo（公開鍵 + credentialId + salt、秘密鍵は
 * 含まない）を first-party cookie にミラーしておけば、SAA grant 後に iframe
 * 側から読み出せる。
 */

export interface CookieStorageOptions {
  /**
   * cookie 名のプレフィクス。複数キーが共存しても衝突しないよう名前空間化する。
   * @default 'nosskey:'
   */
  prefix?: string;
  /**
   * `Max-Age` (秒)。デフォルト 1 年。`Session` cookie だと Safari の
   * ITP で短命扱いされる可能性があるため明示する。
   */
  maxAgeSeconds?: number;
  /**
   * テスト時に注入する `document` ライク。本番では `globalThis.document` を使う。
   */
  document?: { cookie: string };
}

interface ResolvedOptions {
  prefix: string;
  maxAgeSeconds: number;
  document: { cookie: string } | null;
}

const DEFAULT_PREFIX = 'nosskey:';
const DEFAULT_MAX_AGE_SECONDS = 31_536_000; // 1 year

function resolveOptions(options?: CookieStorageOptions): ResolvedOptions {
  const doc =
    options?.document ??
    (typeof document !== 'undefined' ? (document as { cookie: string }) : null);
  return {
    prefix: options?.prefix ?? DEFAULT_PREFIX,
    maxAgeSeconds: options?.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS,
    document: doc,
  };
}

function parseCookies(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const pair of raw.split(';')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    map.set(name, value);
  }
  return map;
}

function buildAttributes(maxAgeSeconds: number): string {
  // SameSite=None; Secure は iframe (3rd-party context) で SAA 後に cookie を
  // 共有するのに必須。Secure は HTTPS 必須（localhost は別の制約）。
  // removeItem / clear からも同じ関数経由で `Max-Age=0` を組み立てるため、
  // 属性集合は常に setItem と一致する（不一致だと evict されない）。
  return `Path=/; SameSite=None; Secure; Max-Age=${maxAgeSeconds}`;
}

export class CookieStorage implements Storage {
  readonly #options: ResolvedOptions;

  constructor(options?: CookieStorageOptions) {
    this.#options = resolveOptions(options);
  }

  getItem(key: string): string | null {
    if (!this.#options.document) return null;
    const cookies = parseCookies(this.#options.document.cookie);
    const raw = cookies.get(this.#cookieName(key));
    if (raw === undefined) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      // 不正に壊れた cookie 値（手動編集等）は null を返してフェイルセーフ
      console.warn('[nosskey] CookieStorage: failed to decode cookie value');
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.#options.document) return;
    const encoded = encodeURIComponent(value);
    this.#options.document.cookie = `${this.#cookieName(key)}=${encoded}; ${buildAttributes(
      this.#options.maxAgeSeconds
    )}`;
  }

  removeItem(key: string): void {
    if (!this.#options.document) return;
    // 削除は同じ属性で `Max-Age=0`。属性が不一致だと evict されないため、
    // setItem と共通の `buildAttributes` を使う。
    this.#options.document.cookie = `${this.#cookieName(key)}=; ${buildAttributes(0)}`;
  }

  clear(): void {
    if (!this.#options.document) return;
    const cookies = parseCookies(this.#options.document.cookie);
    for (const name of cookies.keys()) {
      if (name.startsWith(this.#options.prefix)) {
        this.#options.document.cookie = `${name}=; ${buildAttributes(0)}`;
      }
    }
  }

  key(index: number): string | null {
    if (!this.#options.document) return null;
    const ownNames = this.#ownCookieNames();
    return index >= 0 && index < ownNames.length
      ? ownNames[index].slice(this.#options.prefix.length)
      : null;
  }

  get length(): number {
    return this.#ownCookieNames().length;
  }

  #cookieName(key: string): string {
    return `${this.#options.prefix}${key}`;
  }

  #ownCookieNames(): string[] {
    if (!this.#options.document) return [];
    const cookies = parseCookies(this.#options.document.cookie);
    return Array.from(cookies.keys()).filter((name) => name.startsWith(this.#options.prefix));
  }
}
