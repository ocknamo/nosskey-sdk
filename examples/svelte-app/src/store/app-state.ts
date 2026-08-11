import type { NostrKeyInfo } from 'nosskey-sdk';
import { get, writable } from 'svelte/store';
import { getNosskeyManager, resolveStorageHandle } from '../services/nosskey-manager.service.js';
import { type ThemeMode, normalizeThemeMode } from '../theme/palettes.js';
import { refreshAccounts } from './accounts.js';
import {
  DEFAULT_CACHE_TTL_SECONDS,
  cacheSecrets,
  cacheTimeout,
  clampCacheTimeout,
} from './secret-cache-settings.js';

export type ScreenName = 'account' | 'settings' | 'key' | 'iframe';

export type ConsentDecision = 'ask' | 'always' | 'deny';

/**
 * ポリシーキーは `connect` / `signEvent` / `nip44` / `nip04` の 4 種。
 * `connect` は `getPublicKey` / `getRelays`（オリジン単位の接続承認）を、
 * `nip44` / `nip04` は暗号化と復号を同一バケットに集約する。
 */
export type PolicyKey = 'connect' | 'signEvent' | 'nip44' | 'nip04';
export const POLICY_KEYS: readonly PolicyKey[] = [
  'connect',
  'signEvent',
  'nip44',
  'nip04',
] as const;

export type ConsentPolicy = Record<PolicyKey, ConsentDecision>;

/**
 * 信頼済みエントリ。`origin` のすべての操作を許可するのではなく、
 * `methods` に含まれるポリシーキーのみダイアログを省略する。
 */
export interface TrustedOriginEntry {
  origin: string;
  methods: PolicyKey[];
}

const DEFAULT_CONSENT_POLICY: ConsentPolicy = {
  connect: 'ask',
  signEvent: 'ask',
  nip44: 'ask',
  nip04: 'ask',
};

// v2: メソッドスコープ付きエントリの形式。旧 `nosskey_trusted_origins`
// (`string[]`) は破壊的に置き換える（v1 ユーザー無し前提）。
const TRUSTED_ORIGINS_KEY = 'nosskey_trusted_origins_v2';
const CONSENT_POLICY_KEY = 'nosskey_consent_policy';

function isConsentDecision(value: unknown): value is ConsentDecision {
  return value === 'ask' || value === 'always' || value === 'deny';
}

function isPolicyKey(value: unknown): value is PolicyKey {
  return value === 'connect' || value === 'signEvent' || value === 'nip44' || value === 'nip04';
}

export function isScreenName(hash: string): hash is ScreenName {
  return new Set<string>(['account', 'settings', 'key', 'iframe']).has(hash);
}

// 画面状態
export const currentScreen = writable<ScreenName>('account');

// 認証状態
export const isLoggedIn = writable(false);

// Nostrキー情報
export const publicKey = writable<string | null>(null);

/**
 * wrap モード鍵のインポート直後にバックアップを促すモーダル用の状態。
 * 値が非 null の間だけ `WrapKeyBackupPrompt` を表示する。
 *
 * wrap モードでは暗号化済み nsec（`wrapped.payload`）が localStorage に
 * しか存在せず、サイトデータ消去で復元不能になる（直接モードはパスキーから
 * 再導出可能なので対象外）。そのためインポート完了＝鍵が永続化された直後に
 * バックアップ保存を強く推奨する。必須ではなく「後でやる」導線も残す
 * （設定画面からいつでもエクスポートできる）。
 */
export const wrapBackupPrompt = writable<NostrKeyInfo | null>(null);

// テーマ設定（ThemeMode は palettes.ts で定義、ここで再 export して既存 import を維持）
export type { ThemeMode };
export const currentTheme = writable<ThemeMode>('purple-dark');

// 親オリジンから `?embedded=1&theme=...` でテーマを上書きされた場合、
// localStorage には書き戻さない（次回スタンドアロン起動時にユーザー設定を保つため）。
let embeddedThemeOverride = false;

// `reloadSettings()` 実行中は true。ストレージ→メモリの一方向ロード中に
// 永続化 subscriber が同じ値を書き戻す（冗長な setItem と余計な storage
// イベント発火）のを抑止する。
let applyingExternalUpdate = false;

/**
 * 設定の永続化先 Storage を解決する。解決ロジックはサービス層の
 * `resolveStorageHandle()` に一元化しており（リレー設定・アカウント登録簿と
 * 同一ハンドルへ揃える）、ここではその薄いラッパとして公開名を保つ。
 */
function resolveSettingsStorage(): Storage | null {
  return resolveStorageHandle();
}

// 同意ゲート設定
export const trustedOrigins = writable<TrustedOriginEntry[]>([]);
export const consentPolicy = writable<ConsentPolicy>({ ...DEFAULT_CONSENT_POLICY });

/**
 * `deny` ポリシーで自動拒否された回数。サイレントに拒否され続けて
 * 親アプリのプローブを許してしまわないよう、ユーザーに可視化する。
 * メソッドキー単位で集計し、永続化はしない（プロセス内のみ）。
 */
export const denyCounts = writable<Record<PolicyKey, number>>({
  connect: 0,
  signEvent: 0,
  nip44: 0,
  nip04: 0,
});

export function incrementDenyCount(key: PolicyKey): void {
  denyCounts.update((current) => ({ ...current, [key]: current[key] + 1 }));
}

export function resetDenyCounts(): void {
  denyCounts.set({ connect: 0, signEvent: 0, nip44: 0, nip04: 0 });
}

/**
 * localStorage に保存された設定が破損していたことを示すフラグ。
 * 破損は黙ってデフォルト復帰させるが、Settings 画面で可視化する。
 * メモリ内のみで保持（次回起動時はキー単位で再評価される）。
 */
export const storageCorruption = writable<{
  trustedOrigins: boolean;
  consentPolicy: boolean;
}>({ trustedOrigins: false, consentPolicy: false });

// 秘密鍵情報のキャッシュ設定を読み込む
function loadCacheSecretsSetting(): boolean {
  const saved = resolveSettingsStorage()?.getItem('nosskey_cache_secrets') ?? null;
  // デフォルトはtrue（キャッシュする）
  return saved === null ? true : saved === 'true';
}

// キャッシュタイムアウト設定を読み込む
function loadCacheTimeoutSetting(): number {
  const saved = resolveSettingsStorage()?.getItem('nosskey_cache_timeout') ?? null;
  if (saved === null) return DEFAULT_CACHE_TTL_SECONDS;
  // 破損値（NaN・負値・巨大値）は clampCacheTimeout が許容範囲（既定 / 上下限）へ
  // 倒す。reloadSettings 経由で first-party の壊れた値を取り込んでも、SDK の
  // timeoutMs まで範囲外の値が伝播しないようにする。cacheTimeout ストア側でも
  // set 時にクランプするが、読み込み時にも明示してサニタイズ意図を示す。
  return clampCacheTimeout(Number.parseInt(saved, 10));
}

// テーマ設定を読み込む。旧値 ('light'/'dark') は normalizeThemeMode がパープル系へ移行する。
function loadThemeSetting(): ThemeMode {
  if (typeof window !== 'undefined') {
    const normalized = normalizeThemeMode(localStorage.getItem('nosskey_theme'));
    if (normalized) return normalized;
  }
  // デフォルトは現行ダークの見た目を維持するパープルダーク。
  return 'purple-dark';
}

function markCorruption(field: 'trustedOrigins' | 'consentPolicy', reason: string): void {
  // セキュリティ設定の沈黙降格を避けるため、破損は warn＋フラグで明示的に通知する。
  // フェイルクローズに倒すと「明日突然サイトにアクセスできない」事象になるため、
  // ここでは「黙ってデフォルト」ではなく「デフォルトに戻したことを表に出す」方針。
  console.warn(`[nosskey] stored ${field} appears corrupted: ${reason}. Resetting to defaults.`);
  storageCorruption.update((current) => ({ ...current, [field]: true }));
}

// 信頼済みオリジン (v2: メソッドスコープ付き) を読み込む
function loadTrustedOrigins(): TrustedOriginEntry[] {
  const raw = resolveSettingsStorage()?.getItem(TRUSTED_ORIGINS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      markCorruption('trustedOrigins', 'not an array');
      return [];
    }
    const result: TrustedOriginEntry[] = [];
    let droppedAny = false;
    for (const entry of parsed) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { origin?: unknown }).origin === 'string' &&
        Array.isArray((entry as { methods?: unknown }).methods)
      ) {
        const methods = (entry as { methods: unknown[] }).methods.filter(isPolicyKey);
        if (methods.length > 0) {
          result.push({ origin: (entry as { origin: string }).origin, methods });
          continue;
        }
      }
      droppedAny = true;
    }
    if (droppedAny) markCorruption('trustedOrigins', 'invalid entries dropped');
    return result;
  } catch (err) {
    markCorruption('trustedOrigins', err instanceof Error ? err.message : String(err));
    return [];
  }
}

// 同意ポリシーを読み込む
function loadConsentPolicy(): ConsentPolicy {
  const raw = resolveSettingsStorage()?.getItem(CONSENT_POLICY_KEY);
  if (!raw) return { ...DEFAULT_CONSENT_POLICY };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof ConsentPolicy, unknown>>;
    const result: ConsentPolicy = {
      connect: isConsentDecision(parsed.connect) ? parsed.connect : 'ask',
      signEvent: isConsentDecision(parsed.signEvent) ? parsed.signEvent : 'ask',
      nip44: isConsentDecision(parsed.nip44) ? parsed.nip44 : 'ask',
      nip04: isConsentDecision(parsed.nip04) ? parsed.nip04 : 'ask',
    };
    // 元の値が consent decision でない場合 (deny が ask に降格したケース等) は
    // セキュリティ設定の沈黙降格に該当するため、警告フラグを立てる。
    for (const key of POLICY_KEYS) {
      if (parsed[key] !== undefined && !isConsentDecision(parsed[key])) {
        markCorruption('consentPolicy', `invalid value for ${key}`);
        break;
      }
    }
    return result;
  } catch (err) {
    markCorruption('consentPolicy', err instanceof Error ? err.message : String(err));
    return { ...DEFAULT_CONSENT_POLICY };
  }
}

// 初期化
try {
  cacheSecrets.set(loadCacheSecretsSetting());
  cacheTimeout.set(loadCacheTimeoutSetting());

  // 埋め込みモード (`?embedded=1&theme=...`) では親の指定を優先し、localStorage への
  // 書き戻しを抑止する。旧値 ('light'/'dark') は normalizeThemeMode がパープル系へ移行する。
  // 判定は `iframe-mode.ts` を import せずここで直接行う（双方向 import を避けるため）。
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embedded') === '1') {
      const t = normalizeThemeMode(params.get('theme'));
      if (t) {
        embeddedThemeOverride = true;
        currentTheme.set(t);
      }
    }
  }
  if (!embeddedThemeOverride) {
    currentTheme.set(loadThemeSetting());
  }

  // 設定が変更されたら保存
  cacheSecrets.subscribe((value) => {
    if (applyingExternalUpdate) return;
    resolveSettingsStorage()?.setItem('nosskey_cache_secrets', String(value));
  });

  cacheTimeout.subscribe((value) => {
    if (applyingExternalUpdate) return;
    resolveSettingsStorage()?.setItem('nosskey_cache_timeout', String(value));
  });

  currentTheme.subscribe((value) => {
    if (embeddedThemeOverride) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_theme', value);
    }
  });

  trustedOrigins.set(loadTrustedOrigins());
  consentPolicy.set(loadConsentPolicy());

  trustedOrigins.subscribe((value) => {
    if (applyingExternalUpdate) return;
    resolveSettingsStorage()?.setItem(TRUSTED_ORIGINS_KEY, JSON.stringify(value));
  });

  consentPolicy.subscribe((value) => {
    if (applyingExternalUpdate) return;
    resolveSettingsStorage()?.setItem(CONSENT_POLICY_KEY, JSON.stringify(value));
  });

  // 別ドキュメント（設定画面タブ / 署名 iframe）が同じ first-party ストレージへ
  // 設定を書き込んだら storage イベントで通知される。リロード無しで即時同期するため
  // 監視キーの変更時に reloadSettings() で読み直す。storage イベントは変更を行った
  // 当人のドキュメントには発火しないため自己トリガはしない。
  if (typeof window !== 'undefined') {
    const WATCHED_SETTINGS_KEYS = new Set<string>([
      TRUSTED_ORIGINS_KEY,
      CONSENT_POLICY_KEY,
      'nosskey_cache_secrets',
      'nosskey_cache_timeout',
    ]);
    window.addEventListener('storage', (event) => {
      // key が null なのは clear() 由来。監視キー以外は無視する。
      if (event.key !== null && !WATCHED_SETTINGS_KEYS.has(event.key)) return;
      reloadSettings();
    });
  }
} catch (e) {
  console.error('設定の初期化に失敗しました:', e);
}

/**
 * 全設定を現在のストレージ（`resolveSettingsStorage()`）から読み直す。
 * クロスオリジン埋め込み iframe で Storage Access API のグラントを得て
 * `NosskeyManager.setStorageOptions({ storage })` を呼んだ直後に実行する。
 * 埋め込み iframe ではモジュール初期化時に partitioned 側を読んでいるため、
 * grant 後に first-party の値で読み直す必要がある。以降の subscriber 書き込みも
 * 同じハンドル（リレー設定と共通の `manager.getStorageOptions().storage`）へ
 * 向かう。テーマは埋め込み時に親オリジンが指定する既存仕様のため対象外。
 */
export function reloadSettings(): void {
  // ロードした値を永続化 subscriber が即座に書き戻さないよう抑止する。
  // Svelte writable の subscriber は set() 内で同期実行されるため、
  // try/finally のスコープで全 set() の通知を覆える。
  applyingExternalUpdate = true;
  try {
    cacheSecrets.set(loadCacheSecretsSetting());
    cacheTimeout.set(loadCacheTimeoutSetting());
    trustedOrigins.set(loadTrustedOrigins());
    consentPolicy.set(loadConsentPolicy());
  } finally {
    applyingExternalUpdate = false;
  }
}

const HAS_LOGGED_IN_BEFORE_KEY = 'nosskey_has_logged_in_before';

/**
 * ログアウトを跨いで残る「過去ログイン履歴」フラグ。
 * 鍵情報 (`nosskey_pwk`) と独立しているため `clearStoredKeyInfo` の影響を受けない。
 * 認証画面のデフォルトタブ判定 (新規 → register / 再訪 → login) に使う。
 */
export function hasLoggedInBefore(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(HAS_LOGGED_IN_BEFORE_KEY) === 'true';
}

export function markLoggedInBefore(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HAS_LOGGED_IN_BEFORE_KEY, 'true');
}

// リセット関数
export const resetState = () => {
  currentScreen.set('account');
  isLoggedIn.set(false);
  publicKey.set(null);
};

// ログアウト関数
export const logout = () => {
  const nosskeyManager = getNosskeyManager();
  // current ポインタ（nosskey_pwk）と派生キャッシュのみ消去する。アカウント登録簿
  // （nosskey_accounts）は別キーで残るため、wrap モード鍵も失われず再ログインできる。
  // 削除後は hasKeyInfo() が false になり AuthScreen が無言で自動ログインしない。
  // 秘密情報を完全に消す（登録簿ごと削除）には clearStoredKeyInfo() を使う。
  nosskeyManager.clearCurrentKeyInfo();

  // 公開鍵情報をクリア
  publicKey.set(null);

  // ログイン状態を更新
  isLoggedIn.set(false);

  // バックアップ推奨モーダルが表示途中だった場合に AuthScreen 上へ残らないよう閉じる。
  wrapBackupPrompt.set(null);

  // 画面を認証画面に戻す
  currentScreen.set('account');
};

/**
 * 保存済みの鍵情報からログイン状態を復元する。アプリ起動時に画面（account /
 * key / settings）に依存せず一度だけ実行する。これを AccountScreen の onMount
 * だけに置くと、`#/key` などへ直接リロードした場合に AccountScreen がマウント
 * されず、鍵情報があるのに未ログイン表示（ImportKeyInfo）になってしまう。
 * `getPublicKey()` はパスキープロンプトを出さないため起動時に呼んでも安全。
 */
export const restoreLoginState = async (): Promise<void> => {
  const nosskeyManager = getNosskeyManager();

  if (nosskeyManager.hasKeyInfo()) {
    if (get(isLoggedIn)) return;
    try {
      publicKey.set(await nosskeyManager.getPublicKey());
      isLoggedIn.set(true);
    } catch (error) {
      console.error('公開鍵の取得に失敗しました:', error);
    }
  } else {
    isLoggedIn.set(false);
    publicKey.set(null);
  }
};

/**
 * 指定の `NostrKeyInfo` でログイン状態を確立する共通処理。新規作成 / nsec
 * インポート / 保存済みアカウントからの再ログインのいずれの経路でも使う。
 * - current 鍵へ設定（メモリと `nosskey_pwk` を整合）。`setCurrentKeyInfo` は
 *   あわせて SDK 登録簿へ upsert する（pubkey + credentialId 一意・username 保持マージ）。
 * - svelte 側のアカウント一覧ストアを SDK 登録簿から再同期する。
 * - 公開鍵をストアへ反映しログイン状態へ。`getPublicKey()` はパスキー
 *   プロンプトを出さない（UV は次回の署名 / 暗号化時に自然発生する）。
 */
export const loginWith = async (keyInfo: NostrKeyInfo): Promise<void> => {
  const nosskeyManager = getNosskeyManager();
  nosskeyManager.setCurrentKeyInfo(keyInfo);
  refreshAccounts();
  publicKey.set(await nosskeyManager.getPublicKey());
  isLoggedIn.set(true);
  markLoggedInBefore();
  currentScreen.set('account');
};
