import { writable } from 'svelte/store';
import { getNosskeyManager, peekNosskeyManager } from '../services/nosskey-manager.service.js';
import { cacheSecrets, cacheTimeout } from './secret-cache-settings.js';

export type ScreenName = 'account' | 'settings' | 'key' | 'iframe';

export type ConsentDecision = 'ask' | 'always' | 'deny';

/** ポリシーキーは `signEvent` / `nip44` / `nip04` の 3 種で、暗号化と復号は同一バケットに集約される。 */
export type PolicyKey = 'signEvent' | 'nip44' | 'nip04';
export const POLICY_KEYS: readonly PolicyKey[] = ['signEvent', 'nip44', 'nip04'] as const;

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
  return value === 'signEvent' || value === 'nip44' || value === 'nip04';
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

// テーマ設定
export type ThemeMode = 'light' | 'dark' | 'auto';
export const currentTheme = writable<ThemeMode>('dark');

// 親オリジンから `?embedded=1&theme=...` でテーマを上書きされた場合、
// localStorage には書き戻さない（次回スタンドアロン起動時にユーザー設定を保つため）。
let embeddedThemeOverride = false;

/**
 * 設定の永続化先 Storage を解決する。SDK マネージャが Storage Access API
 * グラント後のハンドルを保持していれば、それを使う。これはリレー設定が読む
 * `manager.getStorageOptions().storage` と同一参照であり、handle の正本は
 * SDK マネージャ 1 箇所に集約される。未グラント / スタンドアロンでは
 * `window.localStorage`（= ファーストパーティ）。
 *
 * `peekNosskeyManager()`（未構築なら null、新規構築しない）を使うため、
 * モジュール初期化中に呼ばれてもマネージャを構築せず安全。
 */
function resolveSettingsStorage(): Storage | null {
  const handle = peekNosskeyManager()?.getStorageOptions().storage;
  if (handle) return handle;
  return typeof window !== 'undefined' ? window.localStorage : null;
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
  signEvent: 0,
  nip44: 0,
  nip04: 0,
});

export function incrementDenyCount(key: PolicyKey): void {
  denyCounts.update((current) => ({ ...current, [key]: current[key] + 1 }));
}

export function resetDenyCounts(): void {
  denyCounts.set({ signEvent: 0, nip44: 0, nip04: 0 });
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
  if (saved === null) return 300; // デフォルトは300秒（5分）
  // 破損値（NaN 等）はデフォルトに倒す。reloadSettings 経由で first-party の
  // 壊れた値を取り込んだ場合に NaN が SDK の timeoutMs まで伝播するのを防ぐ。
  const parsed = Number.parseInt(saved, 10);
  return Number.isFinite(parsed) ? parsed : 300;
}

// テーマ設定を読み込む
function loadThemeSetting(): ThemeMode {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nosskey_theme');
    // デフォルトは'dark'（ダークモード）
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
  }
  return 'dark';
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

  // 埋め込みモード (`?embedded=1&theme=light|dark|auto`) では親の指定を優先し、
  // localStorage への書き戻しを抑止する。判定は `iframe-mode.ts` を import せず
  // ここで直接行う（双方向 import を避けるため）。
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('embedded') === '1') {
      const t = params.get('theme');
      if (t === 'light' || t === 'dark' || t === 'auto') {
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
    resolveSettingsStorage()?.setItem('nosskey_cache_secrets', String(value));
  });

  cacheTimeout.subscribe((value) => {
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
    resolveSettingsStorage()?.setItem(TRUSTED_ORIGINS_KEY, JSON.stringify(value));
  });

  consentPolicy.subscribe((value) => {
    resolveSettingsStorage()?.setItem(CONSENT_POLICY_KEY, JSON.stringify(value));
  });
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
  cacheSecrets.set(loadCacheSecretsSetting());
  cacheTimeout.set(loadCacheTimeoutSetting());
  trustedOrigins.set(loadTrustedOrigins());
  consentPolicy.set(loadConsentPolicy());
}

// リセット関数
export const resetState = () => {
  currentScreen.set('account');
  isLoggedIn.set(false);
  publicKey.set(null);
};

// ログアウト関数
export const logout = () => {
  // SDK側のアカウント情報をクリア
  const nosskeyManager = getNosskeyManager();
  nosskeyManager.clearStoredKeyInfo();

  // 公開鍵情報をクリア
  publicKey.set(null);

  // ログイン状態を更新
  isLoggedIn.set(false);

  // 画面を認証画面に戻す
  currentScreen.set('account');
};
