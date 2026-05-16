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

/** 秘密鍵情報をメモリにキャッシュするか。 */
export const cacheSecrets = writable<boolean>(true);

/** キャッシュのタイムアウト時間（秒）。 */
export const cacheTimeout = writable<number>(300);
