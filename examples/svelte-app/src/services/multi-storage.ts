/**
 * `Storage` 互換のデュアルライト・アダプタ。primary には読み書き、mirrors には
 * 書き込みのみミラーする。primary が `null` を返したときに限り mirrors から
 * 読み出し、ヒットしたら primary に back-fill する。
 *
 * 目的: スタンドアロンタブでは localStorage を主、cookie をミラーとして
 * 運用し、cross-origin iframe（cookie が unpartition される側）から後で
 * 読めるようにする。
 */

export interface MultiStorageOptions {
  primary: Storage;
  mirrors: Storage[];
}

export class MultiStorage implements Storage {
  readonly #primary: Storage;
  readonly #mirrors: Storage[];

  constructor(options: MultiStorageOptions) {
    this.#primary = options.primary;
    this.#mirrors = options.mirrors;
  }

  getItem(key: string): string | null {
    const direct = this.#primary.getItem(key);
    if (direct !== null) return direct;
    for (const mirror of this.#mirrors) {
      try {
        const fallback = mirror.getItem(key);
        if (fallback !== null) {
          // ミラーにあったら primary にも書き戻して以降の読み出しを早くし、
          // ストレージ間の整合性も担保する。書き込み失敗は無視（読み取りに
          // 影響しない）。
          try {
            this.#primary.setItem(key, fallback);
          } catch {
            /* primary 書き込み失敗は無害 */
          }
          return fallback;
        }
      } catch {
        /* mirror 読み取り失敗は次の mirror に進む */
      }
    }
    return null;
  }

  setItem(key: string, value: string): void {
    // primary の失敗は呼び出し元に伝える（重要な障害）。mirror の失敗は
    // 隔離して primary 永続化を守る（cookie 上限超過などで primary を巻き
    // 込まないため）。
    this.#primary.setItem(key, value);
    for (const mirror of this.#mirrors) {
      try {
        mirror.setItem(key, value);
      } catch (err) {
        console.warn('[nosskey] MultiStorage: mirror setItem failed', err);
      }
    }
  }

  removeItem(key: string): void {
    this.#primary.removeItem(key);
    for (const mirror of this.#mirrors) {
      try {
        mirror.removeItem(key);
      } catch (err) {
        console.warn('[nosskey] MultiStorage: mirror removeItem failed', err);
      }
    }
  }

  clear(): void {
    this.#primary.clear();
    for (const mirror of this.#mirrors) {
      try {
        mirror.clear();
      } catch {
        /* best-effort */
      }
    }
  }

  key(index: number): string | null {
    return this.#primary.key(index);
  }

  get length(): number {
    return this.#primary.length;
  }
}
