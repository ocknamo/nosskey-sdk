/**
 * iOS / WebKit のストレージ分離調査のための診断スナップショット。
 *
 * 「iframe から鍵情報が見えない」という症状に対し、**どの経路のどこで値が
 * 落ちているか**（partitioned localStorage / SAA グラント / cookie ブリッジ）を
 * 実機で切り分けるためのもの。DevTools を開けない iOS 実機で、
 * console-daijin のオンページパネルに出す前提で設計している。
 *
 * **本モジュールは値を一切出さない。** 記録するのはキー名・バイト長・モード種別だけ。
 * `NostrKeyInfo` に秘密鍵は含まれないが、`pubkey` / `credentialId` は利用者を
 * 一意に特定できるうえ、ログはスクリーンショットや貼り付けで外部へ渡る前提の
 * ため、識別子そのものをパネルに出さない方針とする。
 * （パネル自体はアプリ全体の console を取り込むため、この保証が及ぶのは本モジュールが
 * 出す行だけである。`docs/ja/ios-iframe-diagnostics.ja.md` の「ログの持ち出し」節を参照。）
 *
 * **SDK の状態照会 API は呼ばない。** `NosskeyManager.hasKeyInfo()` は読み込んだ
 * 鍵情報をメモリへキャッシュし、旧 salt を検出するとストレージへ書き戻す。計測が
 * 観測対象を書き換えると、後続の `applyStorageGrant()` の判定が変わり調査結果その
 * ものを誤らせるため、ストレージハンドルから `getItem` で直接読む。
 */
import { DEFAULT_COOKIE_PREFIX } from '../services/cookie-storage.js';
import { isLikelyWebKit } from '../utils/user-agent.js';

/** 診断対象の SDK ストレージキー。current スロットと登録簿のみを見る。 */
const KEY_INFO_KEYS = ['nosskey_pwk', 'nosskey_keyinfo', 'nosskey_accounts'] as const;

/** 保存値の「形」だけを表す分類。値そのものは記録しない。 */
export type KeyInfoMode = 'direct' | 'wrap' | 'mixed' | 'empty' | 'unparsable';

export interface StoredKeyStat {
  key: string;
  /** 保存されている文字列のバイト長（cookie の 4KB 上限判定に使う）。 */
  length: number;
  mode: KeyInfoMode;
}

export interface StorageDiagnostics {
  /** クエリ・ハッシュを落とした現在地。オリジン不一致（www / pages.dev）の検出用。 */
  origin: string;
  path: string;
  route: string;
  userAgent: string;
  /** iframe の中にいるか。 */
  framed: boolean;
  secureContext: boolean;
  /** `IframeHostScreen` の cookie フォールバック分岐と同一の判定結果。 */
  webkitHeuristic: boolean;
  storageAccessApi: 'available' | 'missing';
  localStorage: { available: boolean; entries: StoredKeyStat[]; error?: string };
  cookie: { total: number; nosskey: StoredKeyStat[]; totalLength: number; error?: string };
  /**
   * SDK のストレージハンドル越しの観測値。SAA グラント後や cookie 経路への
   * 差し替え後は `window.localStorage` と中身が食い違うため、別枠で記録する。
   */
  manager: {
    initialized: boolean;
    storageKind: string;
    entries: StoredKeyStat[];
    error?: string;
  };
}

/** マネージャ側の観測値。未構築（`peekNosskeyManager()` が null）も表現する。 */
export interface ManagerSnapshot {
  initialized: boolean;
  /** `manager.getStorageOptions().storage`。実装クラス名と中身の読み取りに使う。 */
  storage: Storage | null;
}

export interface DiagnosticsSources {
  location: Pick<Location, 'origin' | 'pathname' | 'hash'>;
  userAgent: string;
  framed: boolean;
  secureContext: boolean;
  hasStorageAccessApi: boolean;
  /** `window.localStorage`。アクセス自体が throw する環境があるので取得済みの値か null を渡す。 */
  localStorage: Storage | null;
  localStorageError?: string;
  /** `document.cookie` の生文字列。 */
  cookie: string;
  manager: ManagerSnapshot;
}

/**
 * 保存文字列を「値を出さずに」分類する。`wrapped` の有無で wrap モードか直接
 * モードかが分かり、iframe 復旧をストレージ非依存にできるか（直接モードなら
 * パスキーだけで復元可能）の判断材料になる。
 */
export function classifyKeyInfo(raw: string | null): KeyInfoMode {
  if (raw === null || raw === '') return 'empty';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'unparsable';
  }
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  if (entries.length === 0) return 'empty';
  let direct = 0;
  let wrap = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') return 'unparsable';
    if ('wrapped' in (entry as Record<string, unknown>)) wrap += 1;
    else direct += 1;
  }
  if (wrap > 0 && direct > 0) return 'mixed';
  return wrap > 0 ? 'wrap' : 'direct';
}

/** `document.cookie` を `name=value` の対に分解する。 */
function parseCookiePairs(raw: string): { name: string; value: string }[] {
  if (!raw) return [];
  const pairs: { name: string; value: string }[] = [];
  for (const chunk of raw.split(';')) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    pairs.push({ name: trimmed.slice(0, eq), value: trimmed.slice(eq + 1) });
  }
  return pairs;
}

function decodeCookieValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** ハッシュからルート名だけを取り出す（`#/iframe?debug=1` → `/iframe`）。 */
function routeOf(hash: string): string {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryAt = withoutHash.indexOf('?');
  return (queryAt < 0 ? withoutHash : withoutHash.slice(0, queryAt)) || '/';
}

/**
 * ストレージから鍵情報キーを読み、値を出さない統計に畳む。`getItem` しか呼ばない
 * ので SDK 側のキャッシュや書き戻しは発生しない。
 */
function readEntries(storage: Storage): { entries: StoredKeyStat[]; error?: string } {
  const entries: StoredKeyStat[] = [];
  for (const key of KEY_INFO_KEYS) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      entries.push({ key, length: raw.length, mode: classifyKeyInfo(raw) });
    } catch (err) {
      return { entries, error: err instanceof Error ? err.name : String(err) };
    }
  }
  return { entries };
}

/** 注入された素材から診断スナップショットを組み立てる純粋関数。 */
export function buildStorageDiagnostics(sources: DiagnosticsSources): StorageDiagnostics {
  const ls = sources.localStorage ? readEntries(sources.localStorage) : { entries: [] };
  const lsError = ls.error ?? sources.localStorageError;
  const lsAvailable = sources.localStorage !== null && ls.error === undefined;
  const lsEntries = ls.entries;

  const managerStorage = sources.manager.storage;
  const managerRead = managerStorage ? readEntries(managerStorage) : { entries: [] };

  const pairs = parseCookiePairs(sources.cookie);
  const nosskeyCookies: StoredKeyStat[] = [];
  for (const pair of pairs) {
    if (!pair.name.startsWith(DEFAULT_COOKIE_PREFIX)) continue;
    const decoded = decodeCookieValue(pair.value);
    nosskeyCookies.push({
      key: pair.name,
      // 上限判定に効くのは cookie ヘッダ上の長さなのでエンコード済みの長さを採る。
      length: pair.value.length,
      mode: decoded === null ? 'unparsable' : classifyKeyInfo(decoded),
    });
  }

  return {
    origin: sources.location.origin,
    path: sources.location.pathname,
    route: routeOf(sources.location.hash),
    userAgent: sources.userAgent,
    framed: sources.framed,
    secureContext: sources.secureContext,
    webkitHeuristic: isLikelyWebKit(sources.userAgent),
    storageAccessApi: sources.hasStorageAccessApi ? 'available' : 'missing',
    localStorage: {
      available: lsAvailable,
      entries: lsEntries,
      ...(lsError && { error: lsError }),
    },
    cookie: {
      total: pairs.length,
      nosskey: nosskeyCookies,
      totalLength: sources.cookie.length,
    },
    manager: {
      initialized: sources.manager.initialized,
      storageKind: sources.manager.initialized
        ? (managerStorage?.constructor?.name ?? 'none')
        : 'not-initialized',
      entries: managerRead.entries,
      ...(managerRead.error && { error: managerRead.error }),
    },
  };
}

/** 人が iPhone の小さいパネルで読める 1 行/項目の整形。 */
export function formatStorageDiagnostics(d: StorageDiagnostics): string {
  const stat = (list: StoredKeyStat[]) =>
    list.length === 0 ? '(none)' : list.map((e) => `${e.key}=${e.length}B/${e.mode}`).join(' ');
  return [
    `where: ${d.origin}${d.path} route=${d.route} framed=${d.framed} secure=${d.secureContext}`,
    `ua: ${d.userAgent}`,
    `webkitHeuristic=${d.webkitHeuristic} storageAccessApi=${d.storageAccessApi}`,
    `localStorage: available=${d.localStorage.available}${
      d.localStorage.error ? ` error=${d.localStorage.error}` : ''
    } ${stat(d.localStorage.entries)}`,
    `cookie: total=${d.cookie.total} len=${d.cookie.totalLength} ${stat(d.cookie.nosskey)}`,
    `manager: initialized=${d.manager.initialized} storage=${d.manager.storageKind}${
      d.manager.error ? ` error=${d.manager.error}` : ''
    } ${stat(d.manager.entries)}`,
  ].join('\n');
}
