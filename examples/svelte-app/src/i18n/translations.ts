/**
 * 多言語対応のための翻訳ファイル
 */

// 言語タイプの定義
export type Language = 'ja' | 'en';

// 翻訳データの型定義
export interface TranslationData {
  common: {
    save: string;
    cancel: string;
    close: string;
    ok: string;
    error: string;
    success: string;
    back: string;
  };
  auth: {
    title: string;
    subtitle: string;
    checkPrf: string;
    unsupportedTitle: string;
    createNew: string;
    loginWith: string;
    login: string;
    loading: string;
    username: string;
    usernamePlaceholder: string;
    importTitle: string;
    importSubtitle: string;
    secretKey: string;
    secretKeyHelp: string;
    importButton: string;
  };
  nostr: {
    title: string;
    publicKey: string;
    relayStatus: string;
    relayStates: {
      connected: string;
      connecting: string;
      disconnected: string;
      unknown: string;
    };
    eventCreation: string;
    content: string;
    contentPlaceholder: string;
    sign: string;
    publish: string;
    signedEvent: string;
  };
  settings: {
    title: string;
    relayManagement: {
      title: string;
      description: string;
      currentRelays: string;
      noRelays: string;
      delete: string;
      addRelay: string;
      add: string;
      reset: string;
      messages: {
        enterUrl: string;
        startWithWss: string;
        alreadyExists: string;
        added: string;
        deleted: string;
        reset: string;
      };
    };
    localStorage: {
      title: string;
      description: string;
      clear: string;
      cleared: string;
    };
    cacheSettings: {
      title: string;
      description: string;
      enabled: string;
      disabled: string;
      saved: string;
    };
    appInfo: {
      title: string;
      version: string;
      buildDate: string;
    };
    language: {
      title: string;
      selectLanguage: string;
      japaneseLabel: string;
      englishLabel: string;
      changed: string;
    };
  };
  navigation: {
    auth: string;
    nostr: string;
    settings: string;
    logout: string;
  };
}

// 日本語翻訳
export const ja: TranslationData = {
  common: {
    save: '保存',
    cancel: 'キャンセル',
    close: '閉じる',
    ok: 'OK',
    error: 'エラー',
    success: '成功',
    back: '戻る',
  },
  auth: {
    title: 'Nosskey デモ',
    subtitle: 'パスキー由来のNostr鍵 (PRF直接使用)',
    checkPrf: 'PRF拡張対応確認',
    unsupportedTitle: 'PRF拡張がサポートされていません',
    createNew: '新規作成',
    loginWith: '既存のパスキーでログイン',
    login: 'ログイン',
    loading: 'ロード中...',
    username: 'ユーザー名（オプション）',
    usernamePlaceholder: 'ユーザー名を入力',
    importTitle: '既存のNostr鍵をインポート',
    importSubtitle: '既存の秘密鍵をパスキーで保護します',
    secretKey: 'Nostr秘密鍵',
    secretKeyHelp: '秘密鍵は設定後にサーバーに送信されず、ブラウザ内で処理されます',
    importButton: 'インポート',
  },
  nostr: {
    title: 'Nostr',
    publicKey: '公開鍵',
    relayStatus: 'リレー接続状態',
    relayStates: {
      connected: '接続済み',
      connecting: '接続中',
      disconnected: '切断',
      unknown: '不明',
    },
    eventCreation: 'イベント作成',
    content: '内容:',
    contentPlaceholder: 'ここにメッセージを入力...',
    sign: '署名',
    publish: '公開',
    signedEvent: '署名済みイベント',
  },
  settings: {
    title: '設定',
    relayManagement: {
      title: 'リレー管理',
      description: 'Nostrメッセージを送信するリレーを追加・削除できます。',
      currentRelays: '現在のリレー',
      noRelays: 'リレーが設定されていません',
      delete: '削除',
      addRelay: 'リレーを追加',
      add: '追加',
      reset: 'デフォルトに戻す',
      messages: {
        enterUrl: 'リレーURLを入力してください',
        startWithWss: 'リレーURLは \'wss://\' で始める必要があります',
        alreadyExists: 'このリレーは既に追加されています',
        added: 'リレーを追加しました',
        deleted: 'リレーを削除しました',
        reset: 'リレーをデフォルト設定にリセットしました',
      },
    },
    localStorage: {
      title: 'ローカルストレージ',
      description: '保存された認証情報をクリアします。この操作を行うと再度ログインが必要になります。',
      clear: '認証情報をクリア',
      cleared: 'ローカルストレージをクリアしました',
    },
    cacheSettings: {
      title: 'シークレットキャッシュ設定',
      description: '認証情報（秘密鍵など）をローカルストレージに保存するかどうかを設定します。有効にすると次回起動時に再認証をスキップできます。',
      enabled: '認証情報をキャッシュする',
      disabled: '認証情報をキャッシュしない',
      saved: '設定を保存しました',
    },
    appInfo: {
      title: 'アプリケーション情報',
      version: 'バージョン:',
      buildDate: 'ビルド日時:',
    },
    language: {
      title: '言語設定',
      selectLanguage: '表示言語を選択:',
      japaneseLabel: '日本語',
      englishLabel: '英語 (English)',
      changed: '言語を変更しました',
    },
  },
  navigation: {
    auth: '認証',
    nostr: '投稿',
    settings: '設定',
    logout: 'ログアウト',
  },
};

// 英語翻訳
export const en: TranslationData = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    ok: 'OK',
    error: 'Error',
    success: 'Success',
    back: 'Back',
  },
  auth: {
    title: 'Nosskey Demo',
    subtitle: 'Passkey-derived Nostr Key (Direct PRF)',
    checkPrf: 'Check PRF Extension Support',
    unsupportedTitle: 'PRF Extension Not Supported',
    createNew: 'Create New',
    loginWith: 'Login with Existing Passkey',
    login: 'Login',
    loading: 'Loading...',
    username: 'Username (Optional)',
    usernamePlaceholder: 'Enter username',
    importTitle: 'Import Existing Nostr Key',
    importSubtitle: 'Protect your existing secret key with a passkey',
    secretKey: 'Nostr Secret Key',
    secretKeyHelp: 'Your secret key is processed locally and never sent to any server',
    importButton: 'Import',
  },
  nostr: {
    title: 'Nostr',
    publicKey: 'Public Key',
    relayStatus: 'Relay Connection Status',
    relayStates: {
      connected: 'Connected',
      connecting: 'Connecting',
      disconnected: 'Disconnected',
      unknown: 'Unknown',
    },
    eventCreation: 'Create Event',
    content: 'Content:',
    contentPlaceholder: 'Enter your message here...',
    sign: 'Sign',
    publish: 'Publish',
    signedEvent: 'Signed Event',
  },
  settings: {
    title: 'Settings',
    relayManagement: {
      title: 'Relay Management',
      description: 'Add or remove relays to send Nostr messages.',
      currentRelays: 'Current Relays',
      noRelays: 'No relays configured',
      delete: 'Delete',
      addRelay: 'Add Relay',
      add: 'Add',
      reset: 'Reset to Default',
      messages: {
        enterUrl: 'Please enter a relay URL',
        startWithWss: 'Relay URL must start with \'wss://\'',
        alreadyExists: 'This relay is already added',
        added: 'Relay added successfully',
        deleted: 'Relay deleted',
        reset: 'Relays reset to default settings',
      },
    },
    localStorage: {
      title: 'Local Storage',
      description: 'Clear stored authentication information. You will need to login again after this operation.',
      clear: 'Clear Auth Data',
      cleared: 'Local storage cleared',
    },
    cacheSettings: {
      title: 'Secret Caching Settings',
      description: 'Configure whether authentication data (including secret keys) should be stored in local storage. When enabled, you can skip re-authentication on startup.',
      enabled: 'Cache authentication data',
      disabled: 'Do not cache authentication data',
      saved: 'Settings saved',
    },
    appInfo: {
      title: 'Application Info',
      version: 'Version:',
      buildDate: 'Build Date:',
    },
    language: {
      title: 'Language Settings',
      selectLanguage: 'Select language:',
      japaneseLabel: 'Japanese (日本語)',
      englishLabel: 'English',
      changed: 'Language changed',
    },
  },
  navigation: {
    auth: 'Auth',
    nostr: 'Post',
    settings: 'Settings',
    logout: 'Logout',
  },
};

// 言語ストアの型定義
export interface I18nStore {
  currentLanguage: Language;
  t: TranslationData;
}
