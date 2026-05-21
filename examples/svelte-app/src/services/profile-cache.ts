/**
 * Nostr kind:0 profile の localStorage キャッシュと picture URL のバリデーション。
 *
 * リレーアクセスを毎回行うとログイン時の体感が遅いため stale-while-revalidate
 * 用に保存しておく。攻撃者が `picture` に細工した URL を入れて読み込ませる
 * リスクに対しては `isSafePictureUrl` で `https:` 限定 + ループバック拒否を行う。
 */

export interface CachedProfile {
  picture: string | null;
  name?: string;
  display_name?: string;
  updatedAt: number;
}

export type ProfileCacheMap = Record<string, CachedProfile>;

export const PROFILE_CACHE_KEY = 'nosskey_profile_cache';
const DEFAULT_MAX_ENTRIES = 32;

function resolveStorage(override?: Storage | null): Storage | null {
  if (override) return override;
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

function readMap(storage: Storage | null): ProfileCacheMap {
  if (!storage) return {};
  const raw = storage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as ProfileCacheMap;
  } catch {
    return {};
  }
}

function writeMap(storage: Storage | null, map: ProfileCacheMap): void {
  if (!storage) return;
  try {
    storage.setItem(PROFILE_CACHE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('[nosskey] failed to persist profile cache:', err);
  }
}

/** キャッシュからプロフィールを取得。存在しない/破損は null。 */
export function loadCachedProfile(pubkey: string, storage?: Storage | null): CachedProfile | null {
  const map = readMap(resolveStorage(storage));
  const entry = map[pubkey];
  if (!entry || typeof entry !== 'object') return null;
  // picture は `null` も正常値（取得済みだが picture フィールド無し）として保存している。
  if (entry.picture !== null && typeof entry.picture !== 'string') return null;
  if (typeof entry.updatedAt !== 'number') return null;
  return entry;
}

/**
 * プロフィールをキャッシュへ書き込む。`max` を超えたら updatedAt が古い
 * ものから順に間引く（FIFO 的）。
 */
export function saveCachedProfile(
  pubkey: string,
  profile: CachedProfile,
  storage?: Storage | null,
  max: number = DEFAULT_MAX_ENTRIES
): void {
  const target = resolveStorage(storage);
  const map = readMap(target);
  map[pubkey] = profile;
  pruneMap(map, max);
  writeMap(target, map);
}

function pruneMap(map: ProfileCacheMap, max: number): void {
  const keys = Object.keys(map);
  if (keys.length <= max) return;
  const sorted = keys.map((k) => [k, map[k].updatedAt] as const).sort((a, b) => a[1] - b[1]);
  const removeCount = keys.length - max;
  for (let i = 0; i < removeCount; i++) {
    delete map[sorted[i][0]];
  }
}

/** テスト用に手動で間引きたいとき向け。 */
export function pruneCache(storage?: Storage | null, max: number = DEFAULT_MAX_ENTRIES): void {
  const target = resolveStorage(storage);
  const map = readMap(target);
  pruneMap(map, max);
  writeMap(target, map);
}

const FORBIDDEN_HOSTNAMES = new Set(['localhost', '0.0.0.0', '[::1]', '::1']);

/**
 * `picture` フィールドの URL を安全に表示できるかを検証する。
 *
 * - `new URL()` で解析できる必要がある
 * - スキームは `https:` のみ（`http:` / `data:` / `blob:` / `javascript:` / `file:` 等は不可）
 * - URL に `user:password@` を含むものは不可（クレデンシャル漏れ・fingerprinting 防止）
 * - ホスト名がローカルループバック（localhost / 127.0.0.0/8 / IPv6 loopback）は不可
 *
 * RFC1918 のプライベート IP（10/8, 172.16/12, 192.168/16）やリンクローカル
 * （169.254/16・AWS metadata 含む）、IPv6 ULA / link-local は**意図的に許容**して
 * いる。本関数の利用箇所は `<img>` タグでのレンダリングのみで、レスポンス内容は
 * 同一オリジン JS から読めず、`referrerpolicy="no-referrer"` も付けている。
 * 一般 Nostr ユーザのプロフィール画像ホストはパブリック CDN が普通であり、
 * 厳密な内部レンジ遮断は過剰と判断した。SSRF 想定が必要になった場合は
 * blocklist を追加すること。
 *
 * 通過時は正規化済み URL 文字列、不可なら null。
 */
export function isSafePictureUrl(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  const host = url.hostname.toLowerCase();
  if (FORBIDDEN_HOSTNAMES.has(host)) return null;
  if (host.startsWith('127.')) return null;
  return url.toString();
}
