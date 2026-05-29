import type { NostrKeyInfo } from 'nosskey-sdk';
import { writable } from 'svelte/store';
import { peekNosskeyManager } from '../services/nosskey-manager.service.js';

/**
 * 退避用アカウント登録簿のストレージキー。SDK が current 鍵を書く
 * `nosskey_pwk` とは独立したキーで保持する。これによりログアウト
 * （current ポインタ削除）後も、保存済みアカウント（特に復元不能な
 * wrap モードの `wrapped.payload`）が失われず、一覧から再ログインできる。
 */
const ACCOUNTS_KEY = 'nosskey_accounts';

// SDK の normalizeSalt と同一値（packages/nosskey-sdk/src/nosskey.ts）。
const STANDARD_SALT = '6e6f7374722d70776b';
const LEGACY_SALT = '6e6f7374722d6b6579';

/**
 * NostrKeyInfo.salt を PRF 評価入力として使える値へ正規化する。
 * SDK は current ポインタ読み込み時のみ修復するため、登録簿の入口で揃えておく。
 * wrap モードの WRAP_SALT はそのまま維持される（`undefined` / 旧誤値のみ置換）。
 */
function normalizeSalt(salt?: string): string {
  return !salt || salt === LEGACY_SALT ? STANDARD_SALT : salt;
}

/**
 * 登録簿の永続化先 Storage を解決する。`app-state.ts` の
 * `resolveSettingsStorage()` と同じく、SDK マネージャが Storage Access API
 * グラント後に保持するハンドル（current 鍵 `nosskey_pwk` の保存先と同一参照）を
 * 使う。これにより cookie ミラー込みで埋め込み iframe の整合が取れる。
 * `peekNosskeyManager()` はマネージャ未構築なら null を返し新規構築しないため、
 * モジュール初期化中に呼ばれても安全。
 */
function resolveStorage(): Storage | null {
  const handle = peekNosskeyManager()?.getStorageOptions().storage;
  if (handle) return handle;
  return typeof window !== 'undefined' ? window.localStorage : null;
}

/** 保存値が NostrKeyInfo の形をしているかの防御的チェック。 */
function isNostrKeyInfo(value: unknown): value is NostrKeyInfo {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.credentialId !== 'string') return false;
  if (typeof v.pubkey !== 'string') return false;
  if (typeof v.salt !== 'string') return false;
  if (v.username !== undefined && typeof v.username !== 'string') return false;
  if (v.wrapped !== undefined) {
    const w = v.wrapped as Record<string, unknown>;
    if (!w || typeof w !== 'object') return false;
    // wrapped は wrap 鍵の本体。形が壊れている要素は復元できないため除外する。
    if (w.v !== 1 || w.alg !== 'nip44-v2' || typeof w.payload !== 'string') return false;
  }
  return true;
}

/** salt を正規化したコピーを返す（入力は変更しない）。 */
function normalizeEntry(keyInfo: NostrKeyInfo): NostrKeyInfo {
  return { ...keyInfo, salt: normalizeSalt(keyInfo.salt) };
}

function load(): NostrKeyInfo[] {
  const raw = resolveStorage()?.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[nosskey] stored accounts is not an array; ignoring');
      return [];
    }
    return parsed.filter(isNostrKeyInfo).map(normalizeEntry);
  } catch (e) {
    console.warn('[nosskey] stored accounts corrupted; ignoring', e);
    return [];
  }
}

function persist(list: NostrKeyInfo[]): void {
  try {
    resolveStorage()?.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to persist accounts', e);
  }
}

/** リアクティブ UI 用のアカウント一覧ストア。 */
export const accounts = writable<NostrKeyInfo[]>([]);

// ストアと永続化を常に同期させるための内部正本。
let current: NostrKeyInfo[] = [];

function set(next: NostrKeyInfo[]): void {
  current = next;
  accounts.set(next);
  persist(next);
}

/** 現在の登録簿を返す。 */
export function listAccounts(): NostrKeyInfo[] {
  return current;
}

/** `pubkey` を一意キーとして追加または更新する。 */
export function upsertAccount(keyInfo: NostrKeyInfo): void {
  const entry = normalizeEntry(keyInfo);
  const idx = current.findIndex((a) => a.pubkey === entry.pubkey);
  const next =
    idx >= 0
      ? current.map((a, i) =>
          // 同一 pubkey は新しい値で更新するが、username は新規取得が無いときに
          // 既存の表示名を残す。パスキーピッカー経由の login() は username を
          // 伴わないため、これが無いと一覧ラベルが短縮 npub に退行する。
          i === idx ? { ...a, ...entry, username: entry.username ?? a.username } : a
        )
      : [...current, entry];
  set(next);
}

/** `pubkey` 一致のアカウントを登録簿から削除する。 */
export function removeAccount(pubkey: string): void {
  set(current.filter((a) => a.pubkey !== pubkey));
}

let initialized = false;

/**
 * 登録簿を初期化する（1 回限り）。SDK マネージャ構築後に呼ぶこと。
 * 登録簿が空で、かつ SDK に current 鍵（`nosskey_pwk`）が残っている既存ユーザーの
 * 場合は、その鍵を登録簿へシードして引き継ぐ（移行）。
 */
export function initAccounts(): void {
  if (initialized) return;
  initialized = true;
  const loaded = load();
  if (loaded.length === 0) {
    // getCurrentKeyInfo() は storage から lazy-load し salt 修復も行う。
    const cur = peekNosskeyManager()?.getCurrentKeyInfo() ?? null;
    if (cur) {
      set([normalizeEntry(cur)]);
      return;
    }
  }
  current = loaded;
  accounts.set(loaded);
}
