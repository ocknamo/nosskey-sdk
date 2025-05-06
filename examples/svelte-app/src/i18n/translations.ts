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
    errorMessages: {
      init: string;
      prfCheck: string;
      passkeyCreation: string;
      login: string;
    };
  };
  appWarning: {
    title: string;
    domainChange: string;
    demoDescription: string;
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
    // 新規追加
    accountTitle: string;
    appDescription: string;
    passkeySectionTitle: string;
    passkeySectionDesc: string;
    crossDeviceTitle: string;
    crossDeviceDesc: string;
    existingPasskeyTitle: string;
    existingPasskeyDesc: string;
    // 開発者向け
    developerSection: string;
    prfDebugInfo: string;
    prfSupportedMessage: string;
    // 初回ログイン
    firstLogin: string;
    passkeyCreated: string;
    proceedWithLogin: string;
    // インポートセクション
    importSectionTitle: string;
    importSectionDesc: string;
    importNotImplemented: string;
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
    timeline: {
      title: string;
      loading: string;
      reload: string;
      retry: string;
      empty: string;
    };
    profile: {
      title: string;
      loading: string;
      save: string;
      saved: string;
      displayName: string;
      displayNamePlaceholder: string;
      username: string;
      usernamePlaceholder: string;
      about: string;
      aboutPlaceholder: string;
      website: string;
      websitePlaceholder: string;
      picture: string;
      picturePlaceholder: string;
    };
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
      timeoutLabel: string;
      clearTitle: string;
      clearDescription: string;
      clearButton: string;
      clearSuccess: string;
      clearError: string;
    };
    logout: {
      title: string;
      description: string;
      button: string;
      success: string;
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
    account: string;
    timeline: string;
    settings: string;
    logout?: string; // 後方互換性のためにオプショナル
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
    errorMessages: {
      init: '初期化エラー:',
      prfCheck: 'PRF対応確認エラー:',
      passkeyCreation: 'パスキー作成エラー:',
      login: 'ログインエラー:',
    },
  },
  appWarning: {
    title: '注意事項',
    domainChange:
      'パスキーは異なるドメインでは使用できません。したがってNosskeyに対応していても異なるドメイン下のアプリではPWK(Passkey Wrapped Key)は使えないため、秘密鍵のエクスポートが必要です',
    demoDescription: 'このアプリはNostr鍵管理のUXのデモンストレーション目的で提供されています。',
  },
  auth: {
    title: 'Nosskey デモ',
    subtitle: 'パスキーにラップされたNostr秘密鍵(PWK)を活用したクライアント',
    checkPrf: 'PRF拡張対応確認',
    unsupportedTitle: 'PRF拡張がサポートされていません',
    createNew: '新規作成',
    loginWith: '既存のパスキーでログイン',
    login: 'ログイン',
    firstLogin: '初回ログイン',
    passkeyCreated: 'パスキーが作成されました',
    proceedWithLogin: 'ログインして続ける',
    loading: 'ロード中...',
    username: 'ユーザー名',
    usernamePlaceholder: 'ユーザー名を入力',
    importTitle: '既存のNostr鍵をインポート',
    importSubtitle:
      '既存の秘密鍵をパスキーで保護します。PRFを直接秘密鍵として使用せず、秘密鍵の暗号化に使用します',
    secretKey: 'Nostr秘密鍵',
    secretKeyHelp: '秘密鍵は設定後にサーバーに送信されず、ブラウザ内で処理されます',
    importButton: 'インポート',
    // 新規追加
    accountTitle: 'Nostrアカウント',
    appDescription:
      'このアプリはパスキー認証を使ってNostr鍵を安全に管理します。パスキーはプラットフォームによりクラウドバックアップされるため煩雑な秘密鍵管理が不要となります',
    passkeySectionTitle: 'パスキーでアカウント作成',
    passkeySectionDesc:
      'パスキーは生体認証や端末のセキュリティ機能を使った簡単で安全な認証方法です。',
    crossDeviceTitle: '幅広い端末で利用可能',
    crossDeviceDesc:
      'お使いの端末が直接対応していなくても、ブラウザのQRコードまたは通知を使って、スマートフォンなどを認証器として利用できます。',
    existingPasskeyTitle: '既存のパスキーでログイン',
    existingPasskeyDesc:
      '以前作成したパスキーで再度ログイン。インポートしたNostr Keyの復元は"まだ"サポートされていません',
    // 開発者向け
    developerSection: '開発者向け',
    prfDebugInfo: 'PRF拡張確認はデバッグ用途です',
    prfSupportedMessage: 'PRF拡張がサポートされています',
    // インポートセクション
    importSectionTitle: 'Nostrアカウント（インポート）',
    importSectionDesc: '既存のNostrアカウントをインポート',
    importNotImplemented: '※インポート鍵による再ログイン機能は未実装です',
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
    timeline: {
      title: 'タイムライン',
      loading: '読み込み中...',
      reload: '更新',
      retry: '再試行',
      empty: '表示するイベントがありません',
    },
    profile: {
      title: 'プロフィール編集',
      loading: '読み込み中...',
      save: '保存',
      saved: '保存しました',
      displayName: '表示名',
      displayNamePlaceholder: '表示される名前を入力',
      username: 'ユーザー名',
      usernamePlaceholder: '@username など',
      about: '自己紹介',
      aboutPlaceholder: '自己紹介文を入力',
      website: 'ウェブサイト',
      websitePlaceholder: 'https://example.com',
      picture: 'プロフィール画像URL',
      picturePlaceholder: 'https://example.com/avatar.jpg',
    },
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
        startWithWss: "リレーURLは 'wss://' で始める必要があります",
        alreadyExists: 'このリレーは既に追加されています',
        added: 'リレーを追加しました',
        deleted: 'リレーを削除しました',
        reset: 'リレーをデフォルト設定にリセットしました',
      },
    },
    localStorage: {
      title: 'ローカルストレージ',
      description:
        '保存された情報を全てクリアします。この操作を行うと再度ログインが必要になります。',
      clear: '情報をクリア',
      cleared: 'ローカルストレージをクリアしました',
    },
    cacheSettings: {
      title: 'シークレットキャッシュ設定',
      description:
        '秘密鍵を一時的にメモリに保存するかどうかを設定します。有効にするとキャッシュ時間内の再認証をスキップできますが、長時間保持すると秘密鍵漏洩やなりすましのリスクが高まります',
      enabled: '秘密鍵をキャッシュする',
      disabled: '秘密鍵をキャッシュしない',
      saved: '設定を保存しました',
      timeoutLabel: 'キャッシュ時間（秒）',
      clearTitle: 'キャッシュのクリア',
      clearDescription:
        '現在のシークレットキーのキャッシュをクリアします。次回の操作時に再認証が必要になります。',
      clearButton: 'キャッシュをクリア',
      clearSuccess: 'シークレットキーのキャッシュがクリアされました。',
      clearError: 'キャッシュのクリアに失敗しました。',
    },
    logout: {
      title: 'ログアウト',
      description: 'アプリからログアウトします。すべてのアカウント情報がクリアされます。',
      button: 'ログアウト',
      success: 'ログアウトが完了しました。',
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
    account: 'アカウント',
    timeline: 'タイムライン',
    settings: '設定',
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
    errorMessages: {
      init: 'Initialization Error:',
      prfCheck: 'PRF Support Check Error:',
      passkeyCreation: 'Passkey Creation Error:',
      login: 'Login Error:',
    },
  },
  appWarning: {
    title: 'Important Notice',
    domainChange:
      'Passkey cannot be used in different domains. Therefore, even if Nosskey is supported, PWK(Passkey Wrapped Key) cannot be used in apps under different domains, so if you want to use them, you must export your private key.',
    demoDescription:
      'This application is provided for the purpose of demonstrating the UX of Nostr key management.',
  },
  auth: {
    title: 'Nosskey Demo',
    subtitle: 'Client using Passkey Wrapped Nostr private Key(PWK)',
    checkPrf: 'Check PRF Extension Support',
    unsupportedTitle: 'PRF Extension Not Supported',
    createNew: 'Create New',
    loginWith: 'Login with Existing Passkey',
    login: 'Login',
    loading: 'Loading...',
    username: 'Username (Optional)',
    usernamePlaceholder: 'Enter username',
    importTitle: 'Import Existing Nostr Key',
    importSubtitle:
      'Protect your existing secret key with a passkey. Do not use PRF directly as private key, use PRF for encryption of private key',
    secretKey: 'Nostr Secret Key',
    secretKeyHelp: 'Your secret key is processed locally and never sent to any server',
    importButton: 'Import',
    // 新規追加
    accountTitle: 'Nostr account',
    appDescription:
      'This app uses passkey authentication to securely manage your Nostr keys. Passkey is cloud-backed by the platform, eliminating the need for cumbersome private key management.',
    passkeySectionTitle: 'Create Account with Passkey',
    passkeySectionDesc:
      'Passkeys are a simple and secure authentication method using biometrics or your device security features.',
    crossDeviceTitle: 'Available on a wide range of devices',
    crossDeviceDesc:
      "Even if your device doesn't directly support it, you can use your smartphone as an authenticator via QR code or browser notification.",
    existingPasskeyTitle: 'Login with Existing Passkey',
    existingPasskeyDesc:
      'Login again with previously created passkey. Recovery of imported Nostr Key is not "yet" supported.',
    // 開発者向け
    developerSection: 'For Developers',
    prfDebugInfo: 'PRF extension check is for debugging purposes',
    prfSupportedMessage: 'PRF extension is supported',
    // 初回ログイン
    firstLogin: 'First Login',
    passkeyCreated: 'Passkey Created Successfully',
    proceedWithLogin: 'Proceed with Login',
    // インポートセクション
    importSectionTitle: 'Nostr Account (Import)',
    importSectionDesc: 'Import Existing Nostr Account',
    importNotImplemented: '* Re-login with imported key is not implemented yet',
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
    timeline: {
      title: 'Timeline',
      loading: 'Loading...',
      reload: 'Reload',
      retry: 'Retry',
      empty: 'No events to display',
    },
    profile: {
      title: 'Edit Profile',
      loading: 'Loading...',
      save: 'Save',
      saved: 'Profile saved',
      displayName: 'Display Name',
      displayNamePlaceholder: 'Enter your display name',
      username: 'Username',
      usernamePlaceholder: '@username etc',
      about: 'About',
      aboutPlaceholder: 'Tell something about yourself',
      website: 'Website',
      websitePlaceholder: 'https://example.com',
      picture: 'Profile Picture URL',
      picturePlaceholder: 'https://example.com/avatar.jpg',
    },
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
        startWithWss: "Relay URL must start with 'wss://'",
        alreadyExists: 'This relay is already added',
        added: 'Relay added successfully',
        deleted: 'Relay deleted',
        reset: 'Relays reset to default settings',
      },
    },
    localStorage: {
      title: 'Local Storage',
      description:
        'Clear all stored information. You will need to login again after this operation.',
      clear: 'Clear Information',
      cleared: 'Local storage cleared',
    },
    cacheSettings: {
      title: 'Secret Caching Settings',
      description:
        'Configure whether to temporarily store the secret key in memory. When enabled, you can skip re-authentication within the cache duration, but keeping it for a long time increases the risk of secret key leakage and impersonation.',
      enabled: 'Cache secret key',
      disabled: 'Do not cache secret key',
      saved: 'Settings saved',
      timeoutLabel: 'Cache Duration (seconds)',
      clearTitle: 'Clear Cache',
      clearDescription:
        'Clear the current secret key cache. You will need to re-authenticate on next operation.',
      clearButton: 'Clear Cache',
      clearSuccess: 'Secret key cache has been cleared.',
      clearError: 'Failed to clear cache.',
    },
    logout: {
      title: 'Logout',
      description: 'Logout from the application. All account information will be cleared.',
      button: 'Logout',
      success: 'Logout completed.',
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
    account: 'Account',
    timeline: 'Timeline',
    settings: 'Settings',
    logout: 'Logout',
  },
};

// 言語ストアの型定義
export interface I18nStore {
  currentLanguage: Language;
  t: TranslationData;
}
