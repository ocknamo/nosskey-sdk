import { writable } from 'svelte/store';

/**
 * 秘密鍵キャッシュ設定ストア。SDK の `KeyCache`（PRF 由来の秘密鍵を一定時間
 * メモリ保持し、操作ごとのパスキー再認証を省く仕組み）を駆動する。
 *
 * このモジュールは `svelte/store` だけに依存する leaf。`app-state.ts` と
 * `nosskey-manager.service.ts` の双方から import されるが、`app-state` ⇄
 * `nosskey-manager.service` の循環 import を生まないよう、ここにはストアの
 * 定義のみを置く。読み込み・永続化は `app-state.ts`、SDK への反映は
 * `nosskey-manager.service.ts` がそれぞれ担う。
 */

/** キャッシュ TTL（秒）の下限。 */
export const MIN_CACHE_TTL_SECONDS = 10;
/**
 * キャッシュ TTL（秒）の上限。セキュリティ診断 2026-06-10（M-3）の推奨に基づき
 * 1 時間で頭打ちにする。長すぎる TTL は平文鍵がメモリに残る時間を不必要に延ばす。
 */
export const MAX_CACHE_TTL_SECONDS = 3600;
/** キャッシュ TTL（秒）の既定値（5 分）。不正値はここへ倒す。 */
export const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * キャッシュ TTL（秒）を許容範囲へクランプする純粋関数。
 *
 * localStorage は改ざん可能なため、保存値（負値・巨大値・NaN/Infinity）が SDK の
 * `timeoutMs` までそのまま伝播するのを防ぐ。NaN/Infinity は既定値、範囲外は端へ
 * 丸め、小数は切り捨てる。
 */
export function clampCacheTimeout(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_CACHE_TTL_SECONDS;
  if (seconds < MIN_CACHE_TTL_SECONDS) return MIN_CACHE_TTL_SECONDS;
  if (seconds > MAX_CACHE_TTL_SECONDS) return MAX_CACHE_TTL_SECONDS;
  return Math.floor(seconds);
}

/** 秘密鍵情報をメモリにキャッシュするか。 */
export const cacheSecrets = writable<boolean>(true);

/**
 * キャッシュのタイムアウト時間（秒）。
 *
 * `set` / `update` を `clampCacheTimeout` で包んだカスタムストアにし、UI 入力・
 * ストレージ読み込み・外部同期のいずれの経路から値が入っても必ず許容範囲に収まる
 * 単一の強制点とする。これにより SDK へ渡る `timeoutMs` も常にクランプ済みになる。
 */
function createCacheTimeoutStore() {
  const { subscribe, set, update } = writable<number>(DEFAULT_CACHE_TTL_SECONDS);
  return {
    subscribe,
    set: (value: number) => set(clampCacheTimeout(value)),
    update: (updater: (value: number) => number) =>
      update((value) => clampCacheTimeout(updater(value))),
  };
}

export const cacheTimeout = createCacheTimeoutStore();
