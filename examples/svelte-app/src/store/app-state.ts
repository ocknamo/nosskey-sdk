import { writable } from 'svelte/store';
import { getNosskeyManager } from '../services/nosskey-manager.service.js';

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

// アプリケーション設定
export const cacheSecrets = writable<boolean>(true); // 秘密鍵情報をキャッシュするかどうか
export const cacheTimeout = writable<number>(300); // キャッシュのタイムアウト時間（秒）

// テーマ設定
export type ThemeMode = 'light' | 'dark' | 'auto';
export const currentTheme = writable<ThemeMode>('dark');

// 同意ゲート設定
export const trustedOrigins = writable<TrustedOriginEntry[]>([]);
export const consentPolicy = writable<ConsentPolicy>({ ...DEFAULT_CONSENT_POLICY });

// 秘密鍵情報のキャッシュ設定を読み込む
function loadCacheSecretsSetting() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nosskey_cache_secrets');
    // デフォルトはtrue（キャッシュする）
    return saved === null ? true : saved === 'true';
  }
  return true;
}

// キャッシュタイムアウト設定を読み込む
function loadCacheTimeoutSetting() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nosskey_cache_timeout');
    // デフォルトは300秒（5分）
    return saved === null ? 300 : Number.parseInt(saved, 10);
  }
  return 300;
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

// 信頼済みオリジン (v2: メソッドスコープ付き) を読み込む
function loadTrustedOrigins(): TrustedOriginEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(TRUSTED_ORIGINS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: TrustedOriginEntry[] = [];
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
        }
      }
    }
    return result;
  } catch {
    // 破損した値は無視してデフォルトを返す
  }
  return [];
}

// 同意ポリシーを読み込む
function loadConsentPolicy(): ConsentPolicy {
  if (typeof window === 'undefined') return { ...DEFAULT_CONSENT_POLICY };
  const raw = localStorage.getItem(CONSENT_POLICY_KEY);
  if (!raw) return { ...DEFAULT_CONSENT_POLICY };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof ConsentPolicy, unknown>>;
    return {
      signEvent: isConsentDecision(parsed.signEvent) ? parsed.signEvent : 'ask',
      nip44: isConsentDecision(parsed.nip44) ? parsed.nip44 : 'ask',
      nip04: isConsentDecision(parsed.nip04) ? parsed.nip04 : 'ask',
    };
  } catch {
    return { ...DEFAULT_CONSENT_POLICY };
  }
}

// 初期化
try {
  cacheSecrets.set(loadCacheSecretsSetting());
  cacheTimeout.set(loadCacheTimeoutSetting());
  currentTheme.set(loadThemeSetting());

  // 設定が変更されたら保存
  cacheSecrets.subscribe((value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_cache_secrets', String(value));
    }
  });

  cacheTimeout.subscribe((value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_cache_timeout', String(value));
    }
  });

  currentTheme.subscribe((value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nosskey_theme', value);
    }
  });

  trustedOrigins.set(loadTrustedOrigins());
  consentPolicy.set(loadConsentPolicy());

  trustedOrigins.subscribe((value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TRUSTED_ORIGINS_KEY, JSON.stringify(value));
    }
  });

  consentPolicy.subscribe((value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CONSENT_POLICY_KEY, JSON.stringify(value));
    }
  });
} catch (e) {
  console.error('設定の初期化に失敗しました:', e);
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
