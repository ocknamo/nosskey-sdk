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
    copy: string;
    copied: string;
    loading: string;
    edit: string;
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
    prfCompatibility: string;
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
    accountTitle: string;
    appDescription: string;
    passkeySectionTitle: string;
    passkeySectionDesc: string;
    crossDeviceTitle: string;
    crossDeviceDesc: string;
    existingPasskeyTitle: string;
    existingPasskeyDesc: string;
    developerSection: string;
    prfDebugInfo: string;
    prfSupportedMessage: string;
    firstLogin: string;
    passkeyCreated: string;
    proceedWithLogin: string;
    keyInfoImportTitle: string;
    keyInfoImportDesc: string;
    keyInfoFileSelect: string;
    keyDataInput: string;
    keyDataPlaceholder: string;
    keyInfoLoginButton: string;
    keyInfoLoginProcessing: string;
    orText: string;
    quickStartTitle: string;
    quickStartDesc: string;
    existingUserTitle: string;
    existingUserDesc: string;
    advancedOptionsTitle: string;
    newUserRecommended: string;
    returningUserRecommended: string;
  };
  nostr: {
    publicKey: string;
    copyToClipboard: string;
    copiedToClipboard: string;
  };
  key: {
    title: string;
  };
  settings: {
    title: string;
    exportSecretKey: string;
    exportSecretKeyWarning: string;
    showExportSection: string;
    hideExportSection: string;
    exportWarningFinal: string;
    confirmExport: string;
    yourSecretKey: string;
    noKeyToExport: string;
    exportKeyInfo: {
      title: string;
      description: string;
      warning: string;
      showExportSection: string;
      hideExportSection: string;
      restoreWarning: string;
      exportButton: string;
      backupData: string;
      saveFile: string;
      saveFileTitle: string;
      noCurrentKeyInfo: string;
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
      commitHash: string;
    };
    language: {
      title: string;
      selectLanguage: string;
      japaneseLabel: string;
      englishLabel: string;
      changed: string;
    };
    theme: {
      title: string;
      description: string;
      light: string;
      dark: string;
      auto: string;
      changed: string;
    };
    relays: {
      title: string;
      description: string;
      addPlaceholder: string;
      addButton: string;
      readLabel: string;
      writeLabel: string;
      removeButton: string;
      invalidUrl: string;
      empty: string;
    };
    trustedOrigins: {
      title: string;
      description: string;
      empty: string;
      removeButton: string;
    };
    consentPolicy: {
      title: string;
      description: string;
      methodLabel: {
        signEvent: string;
        nip44: string;
        nip04: string;
      };
      option: {
        ask: string;
        always: string;
        deny: string;
      };
    };
  };
  navigation: {
    account: string;
    key: string;
    settings: string;
  };
  consent: {
    title: string;
    titleEncrypt: string;
    titleDecrypt: string;
    origin: string;
    eventKind: string;
    eventContent: string;
    eventTags: string;
    noTags: string;
    approve: string;
    reject: string;
    method: string;
    methodLabel: {
      signEvent: string;
      nip44Encrypt: string;
      nip44Decrypt: string;
      nip04Encrypt: string;
      nip04Decrypt: string;
    };
    peerPubkey: string;
    plaintext: string;
    decryptNoPreview: string;
    alwaysAllowSite: string;
    showRaw: string;
    kindLabel: {
      textNote: string;
      follows: string;
      legacyDm: string;
      repost: string;
      reaction: string;
      channelMessage: string;
      giftWrap: string;
      longForm: string;
      unknown: string;
    };
  };
  iframeHost: {
    running: string;
    noKey: string;
    partitionedWarning: string;
    grantStorageAccess: string;
    storageAccessGranted: string;
    storageAccessDenied: string;
    storageAccessUnsupported: string;
    retry: string;
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
    copy: 'コピー',
    copied: 'コピーしました',
    loading: '読み込み中...',
    edit: '編集',
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
      'パスキーは異なるドメインでは使用できないため、ドメインの異なるアプリで使用するにはこれまで通り秘密鍵のエクスポートが必要です。',
    demoDescription:
      'このアプリはパスキーのPRF拡張を用いたNostr鍵管理のUXのデモンストレーションです。そのためクライアントとしての機能は限定的です。',
    prfCompatibility:
      '一部の端末・環境ではPRF拡張が**まだ**サポートされていません。Windows HelloやFirefox（デフォルト設定）では利用できません。また、BitwardenなどのソフトウェアパスキーではPRF拡張が対応していない場合があります。',
  },
  auth: {
    title: 'Nosskey デモ',
    subtitle: 'パスキーで保管するNostr秘密鍵を活用したクライアント',
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
    developerSection: '開発者向け',
    prfDebugInfo: 'PRF拡張確認はデバッグ用途です',
    prfSupportedMessage: 'PRF拡張がサポートされています',
    keyInfoImportTitle: 'バックアップした鍵情報でログイン',
    keyInfoImportDesc: '以前にエクスポートした鍵情報ファイルまたはデータを使用してログインします。',
    keyInfoFileSelect: '📁鍵情報ファイルを選択',
    keyDataInput: '鍵情報データを入力',
    keyDataPlaceholder: '鍵情報データをここに貼り付けてください',
    keyInfoLoginButton: '鍵情報データでログイン',
    keyInfoLoginProcessing: '処理中...',
    orText: 'または',
    quickStartTitle: 'はじめる',
    quickStartDesc: '新規ユーザー向けの最も簡単な方法',
    existingUserTitle: '既存ユーザー',
    existingUserDesc: '以前に作成したアカウントでログイン',
    advancedOptionsTitle: '高度なオプション',
    newUserRecommended: '新規ユーザーにおすすめ',
    returningUserRecommended: '既存ユーザーにおすすめ',
  },
  nostr: {
    publicKey: '公開鍵',
    copyToClipboard: 'クリップボードにコピー',
    copiedToClipboard: 'コピーしました',
  },
  key: {
    title: '鍵管理',
  },
  settings: {
    title: '設定',
    exportSecretKey: '秘密鍵のエクスポート',
    exportSecretKeyWarning:
      '警告：秘密鍵は誰とも共有しないでください。秘密鍵を持つ人はあなたのアカウントを完全に制御できます。',
    showExportSection: '秘密鍵をエクスポート（危険）',
    hideExportSection: 'エクスポートセクションを隠す',
    exportWarningFinal:
      '最終警告：この秘密鍵を共有すると、あなたのアカウントが乗っ取られる可能性があります。必ずバックアップ目的でのみ使用してください。',
    confirmExport: '秘密鍵をエクスポートする（nsec形式）',
    yourSecretKey: 'あなたの秘密鍵：',
    noKeyToExport: 'エクスポートする鍵がありません。ログイン状態を確認してください。',
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
      commitHash: 'コミットハッシュ:',
    },
    language: {
      title: '言語設定',
      selectLanguage: '表示言語を選択:',
      japaneseLabel: '日本語',
      englishLabel: '英語 (English)',
      changed: '言語を変更しました',
    },
    theme: {
      title: 'テーマ設定',
      description: 'アプリケーションの外観を変更できます。',
      light: 'ライトモード',
      dark: 'ダークモード',
      auto: 'システム設定に従う',
      changed: 'テーマを変更しました',
    },
    relays: {
      title: 'リレー設定',
      description:
        '親アプリから getRelays() で参照されるリレー一覧です。Nosskey 自身はリレーへ送信しません。',
      addPlaceholder: 'wss://relay.example',
      addButton: '追加',
      readLabel: '読み取り',
      writeLabel: '書き込み',
      removeButton: '削除',
      invalidUrl: 'wss:// または ws:// で始まる URL を入力してください。',
      empty: 'リレーが登録されていません。',
    },
    trustedOrigins: {
      title: '信頼済みサイト',
      description:
        '同意ダイアログで「このサイトを常に許可」を選んだサイトの一覧です。削除すると次回から再度確認が表示されます。',
      empty: '信頼済みサイトはまだありません。',
      removeButton: '削除',
    },
    consentPolicy: {
      title: 'メソッド別の同意ポリシー',
      description:
        'リクエスト種別ごとに既定の挙動を設定できます。「常に許可」はサイトを問わずスキップ、「拒否」はダイアログを出さずに即拒否します。',
      methodLabel: {
        signEvent: 'イベント署名 (signEvent)',
        nip44: 'NIP-44 暗号化 / 復号',
        nip04: 'NIP-04 暗号化 / 復号（レガシー）',
      },
      option: {
        ask: '毎回確認',
        always: '常に許可',
        deny: '拒否',
      },
    },
    exportKeyInfo: {
      title: '鍵情報のエクスポート',
      description:
        '鍵情報をバックアップして別のデバイスで利用したり、ブラウザデータが消去された場合に復元することができます。',
      warning:
        '注意: この鍵情報を紛失するとアカウントへのアクセスができなくなる場合があります。安全な場所に保管してください。',
      showExportSection: '鍵情報をエクスポート',
      hideExportSection: 'エクスポートセクションを隠す',
      restoreWarning:
        'この鍵情報ファイルは、同じパスキーと同じユーザー名でログインできない場合の復元に使用できます。',
      exportButton: '鍵情報をエクスポート',
      backupData: '鍵情報のバックアップデータ:',
      saveFile: '保存',
      saveFileTitle: 'ファイルに保存',
      noCurrentKeyInfo: '現在の鍵情報が見つかりません。ログイン状態を確認してください。',
    },
  },
  navigation: {
    account: 'アカウント',
    key: '鍵管理',
    settings: '設定',
  },
  consent: {
    title: '署名リクエストの確認',
    titleEncrypt: '暗号化リクエストの確認',
    titleDecrypt: '復号リクエストの確認',
    origin: 'リクエスト元:',
    eventKind: 'イベント種別',
    eventContent: '本文',
    eventTags: 'タグ',
    noTags: '(タグなし)',
    approve: '承認',
    reject: '拒否',
    method: 'リクエスト種別',
    methodLabel: {
      signEvent: 'イベント署名',
      nip44Encrypt: 'NIP-44 暗号化',
      nip44Decrypt: 'NIP-44 復号',
      nip04Encrypt: 'NIP-04 暗号化（レガシー）',
      nip04Decrypt: 'NIP-04 復号（レガシー）',
    },
    peerPubkey: '相手の公開鍵',
    plaintext: '平文',
    decryptNoPreview: '暗号文の内容は復号後にしか確認できません。',
    alwaysAllowSite: 'このサイトを常に許可（同意ダイアログをスキップ）',
    showRaw: '生のイベント JSON を表示',
    kindLabel: {
      textNote: 'テキストノート',
      follows: 'フォローリスト',
      legacyDm: 'ダイレクトメッセージ（NIP-04 レガシー）',
      repost: 'リポスト',
      reaction: 'リアクション',
      channelMessage: 'チャンネルメッセージ',
      giftWrap: 'Gift Wrap',
      longForm: '長文記事',
      unknown: 'その他のイベント',
    },
  },
  iframeHost: {
    running: 'Nosskey iframe が起動中です。親アプリからの署名リクエストを待機します。',
    noKey: '鍵が設定されていません。別タブで設定画面を開き、パスキーでログインしてください。',
    partitionedWarning:
      'このサイトは別ドメインから埋め込まれています。鍵にアクセスするには、下のボタンを押してストレージアクセスを許可してください。',
    grantStorageAccess: 'ストレージアクセスを許可',
    storageAccessGranted: 'アクセスが許可されました。鍵を読み込みました。',
    storageAccessDenied:
      'ストレージアクセスが拒否されました。もう一度試すか、別タブで nosskey.app を開いてください。',
    storageAccessUnsupported: 'このブラウザは Storage Access API をサポートしていません。',
    retry: '再試行',
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
    copy: 'Copy',
    copied: 'Copied',
    loading: 'Loading...',
    edit: 'Edit',
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
      'Passkeys cannot be used across different domains, so traditional private key export is still required to use with applications on different domains.',
    demoDescription:
      'This application is a UX demonstration of Nostr key management using Passkey PRF extension. Therefore, its functionality as a client is limited.',
    prfCompatibility:
      'PRF extension is not **yet** supported on some devices and environments. It is not available on Windows Hello or Firefox (default settings). Additionally, software passkeys like Bitwarden may not support PRF extension.',
  },
  auth: {
    title: 'Nosskey Demo',
    subtitle: 'Client using Nosskey',
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
    developerSection: 'For Developers',
    prfDebugInfo: 'PRF extension check is for debugging purposes',
    prfSupportedMessage: 'PRF extension is supported',
    firstLogin: 'First Login',
    passkeyCreated: 'Passkey Created Successfully',
    proceedWithLogin: 'Proceed with Login',
    keyInfoImportTitle: 'Login with Backed Up KeyInfo',
    keyInfoImportDesc: 'Use a previously exported KeyInfo file or data to login.',
    keyInfoFileSelect: '📁Select KeyInfo File',
    keyDataInput: 'Enter KeyInfo Data',
    keyDataPlaceholder: 'Paste your Key data here',
    keyInfoLoginButton: 'Login with Key Data',
    keyInfoLoginProcessing: 'Processing...',
    orText: 'or',
    quickStartTitle: 'Get Started',
    quickStartDesc: 'Simplest way for new users',
    existingUserTitle: 'Returning Users',
    existingUserDesc: 'Login with previously created account',
    advancedOptionsTitle: 'Advanced Options',
    newUserRecommended: 'Recommended for new users',
    returningUserRecommended: 'Recommended for existing users',
  },
  nostr: {
    publicKey: 'Public Key',
    copyToClipboard: 'Copy to Clipboard',
    copiedToClipboard: 'Copied',
  },
  key: {
    title: 'Key Management',
  },
  settings: {
    title: 'Settings',
    exportSecretKey: 'Export Secret Key',
    exportSecretKeyWarning:
      'Warning: Never share your secret key with anyone. Anyone with your secret key can fully control your account.',
    showExportSection: 'Export Secret Key (Dangerous)',
    hideExportSection: 'Hide Export Section',
    exportWarningFinal:
      'Final Warning: Sharing this secret key can lead to your account being compromised. Use only for backup purposes.',
    confirmExport: 'Export Secret Key (nsec format)',
    yourSecretKey: 'Your Secret Key:',
    noKeyToExport: 'No key to export. Please check your login status.',
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
      commitHash: 'Commit Hash:',
    },
    language: {
      title: 'Language Settings',
      selectLanguage: 'Select language:',
      japaneseLabel: 'Japanese (日本語)',
      englishLabel: 'English',
      changed: 'Language changed',
    },
    theme: {
      title: 'Theme Settings',
      description: 'Change the appearance of the application.',
      light: 'Light Mode',
      dark: 'Dark Mode',
      auto: 'Follow System Setting',
      changed: 'Theme changed',
    },
    relays: {
      title: 'Relay Settings',
      description:
        'Relays returned to parent apps via getRelays(). Nosskey itself does not publish to relays.',
      addPlaceholder: 'wss://relay.example',
      addButton: 'Add',
      readLabel: 'Read',
      writeLabel: 'Write',
      removeButton: 'Remove',
      invalidUrl: 'Please enter a URL starting with wss:// or ws://.',
      empty: 'No relays configured.',
    },
    trustedOrigins: {
      title: 'Trusted sites',
      description:
        'Sites you marked as "always allow" in the consent dialog. Removing a site will make the dialog reappear on the next request.',
      empty: 'No trusted sites yet.',
      removeButton: 'Remove',
    },
    consentPolicy: {
      title: 'Per-method consent policy',
      description:
        'Set the default behavior for each request type. "Always allow" skips the dialog regardless of site, "Deny" rejects without prompting.',
      methodLabel: {
        signEvent: 'Sign event (signEvent)',
        nip44: 'NIP-44 encrypt / decrypt',
        nip04: 'NIP-04 encrypt / decrypt (legacy)',
      },
      option: {
        ask: 'Ask every time',
        always: 'Always allow',
        deny: 'Deny',
      },
    },
    exportKeyInfo: {
      title: 'Export KeyInfo',
      description:
        'You can backup your KeyInfo to use on another device or restore it if your browser data is erased.',
      warning:
        'Warning: Losing this KeyInfo may result in loss of access to your account. Store it in a safe place.',
      showExportSection: 'Export KeyInfo',
      hideExportSection: 'Hide Export Section',
      restoreWarning:
        'This KeyInfo file can be used for recovery when you cannot login with the same passkey and the same username.',
      exportButton: 'Export KeyInfo',
      backupData: 'KeyInfo Backup Data:',
      saveFile: 'Save',
      saveFileTitle: 'Save to file',
      noCurrentKeyInfo: 'Current KeyInfo not found. Please check your login status.',
    },
  },
  navigation: {
    account: 'Account',
    key: 'Key',
    settings: 'Settings',
  },
  consent: {
    title: 'Signing request',
    titleEncrypt: 'Encryption request',
    titleDecrypt: 'Decryption request',
    origin: 'Requesting origin:',
    eventKind: 'Event kind',
    eventContent: 'Content',
    eventTags: 'Tags',
    noTags: '(no tags)',
    approve: 'Approve',
    reject: 'Reject',
    method: 'Request type',
    methodLabel: {
      signEvent: 'Sign event',
      nip44Encrypt: 'NIP-44 encrypt',
      nip44Decrypt: 'NIP-44 decrypt',
      nip04Encrypt: 'NIP-04 encrypt (legacy)',
      nip04Decrypt: 'NIP-04 decrypt (legacy)',
    },
    peerPubkey: 'Peer public key',
    plaintext: 'Plaintext',
    decryptNoPreview: 'Ciphertext contents are only visible after decryption.',
    alwaysAllowSite: 'Always allow this site (skip the consent dialog)',
    showRaw: 'Show raw event JSON',
    kindLabel: {
      textNote: 'Text note',
      follows: 'Follow list',
      legacyDm: 'Direct message (NIP-04 legacy)',
      repost: 'Repost',
      reaction: 'Reaction',
      channelMessage: 'Channel message',
      giftWrap: 'Gift wrap',
      longForm: 'Long-form article',
      unknown: 'Other event',
    },
  },
  iframeHost: {
    running: 'Nosskey iframe is running and waiting for signing requests from the parent app.',
    noKey: 'No key configured. Open the settings page in another tab and sign in with a passkey.',
    partitionedWarning:
      'This page is embedded from a different domain. Grant storage access with the button below to reach your key.',
    grantStorageAccess: 'Grant storage access',
    storageAccessGranted: 'Access granted. Key loaded.',
    storageAccessDenied:
      'Storage access was denied. Retry, or open nosskey.app in another tab to create or unlock your key.',
    storageAccessUnsupported: 'This browser does not support the Storage Access API.',
    retry: 'Retry',
  },
};

// 言語ストアの型定義
export interface I18nStore {
  currentLanguage: Language;
  t: TranslationData;
}
