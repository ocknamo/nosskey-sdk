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
    help: string;
    errorMessages: {
      init: string;
      prfCheck: string;
      passkeyCreation: string;
      login: string;
    };
  };
  appWarning: {
    title: string;
    prfCompatibility: string;
  };
  auth: {
    title: string;
    subtitle: string;
    createNew: string;
    loginWith: string;
    loading: string;
    username: string;
    usernamePlaceholder: string;
    firstLogin: string;
    passkeyCreated: string;
    proceedWithLogin: string;
    tabLogin: string;
    tabRegister: string;
    loginTip: string;
    registerTip: string;
    usernameTip: string;
  };
  nostr: {
    publicKey: string;
    copyToClipboard: string;
    copiedToClipboard: string;
    profileAvatarAlt: string;
    profileFallbackAlt: string;
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
      removeAllButton: string;
      confirmRemove: string;
      confirmRemoveAll: string;
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
      denyCount: string;
      resetDenyCounts: string;
      saved: string;
      corruptionWarning: string;
    };
    developer: {
      title: string;
      description: string;
      checkPrf: string;
      prfSupported: string;
      prfUnsupportedTitle: string;
    };
    import: {
      title: string;
      description: string;
      fileSelect: string;
      dataInput: string;
      dataPlaceholder: string;
      loginButton: string;
      processing: string;
      or: string;
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
    approveOnce: string;
    alwaysAllow: string;
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
      metadata: string;
      textNote: string;
      follows: string;
      legacyDm: string;
      repost: string;
      reaction: string;
      channelMessage: string;
      rumor: string;
      seal: string;
      giftWrap: string;
      longForm: string;
      unknown: string;
    };
    approveAndTrust: string;
    openSettings: string;
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
    partitionedTitle: string;
    deniedTitle: string;
    grantedTitle: string;
    noKeyTitle: string;
    unsupportedTitle: string;
    openSetup: string;
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
    help: 'ヘルプ',
    errorMessages: {
      init: '初期化エラー:',
      prfCheck: 'PRF対応確認エラー:',
      passkeyCreation: 'パスキー作成エラー:',
      login: 'ログインエラー:',
    },
  },
  appWarning: {
    title: '注意事項',
    prfCompatibility: '一部の端末・環境はサポートされていません。',
  },
  auth: {
    title: 'Nosskey',
    subtitle: 'Nostrアカウントをパスキーで',
    createNew: '新規作成',
    loginWith: 'パスキーでログイン',
    firstLogin: '初回ログイン',
    passkeyCreated: 'パスキーが作成されました',
    proceedWithLogin: 'ログインして続ける',
    loading: 'ロード中...',
    username: 'ユーザー名',
    usernamePlaceholder: 'ユーザー名を入力',
    tabLogin: 'ログイン',
    tabRegister: '新規登録',
    loginTip: '以前作成したパスキーで再度ログインします',
    registerTip:
      'パスキーは生体認証や端末のセキュリティ機能を使った安全な認証方法です。お使いの端末が直接対応していなくても、QRコードや通知を使ってスマートフォンなどを認証器として利用できます。',
    usernameTip: 'パスキーの表示名として使われます。任意項目で、未入力でも問題ありません。',
  },
  nostr: {
    publicKey: '公開鍵',
    copyToClipboard: 'クリップボードにコピー',
    copiedToClipboard: 'コピーしました',
    profileAvatarAlt: 'プロフィール画像',
    profileFallbackAlt: 'アバター未設定',
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
      light: 'ライト',
      dark: 'ダーク',
      auto: '自動',
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
        '同意ダイアログで「このサイトを常に許可」を選んだサイトとメソッドの一覧です。許可はメソッドごとに記録され、他のメソッドは別途確認されます。削除すると次回から再度確認が表示されます。',
      empty: '信頼済みサイトはまだありません。',
      removeButton: '削除',
      removeAllButton: '削除',
      confirmRemove: 'このメソッドの自動許可を解除しますか？',
      confirmRemoveAll: 'このサイトの自動許可をすべて解除しますか？',
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
      denyCount: 'このセッションで {count} 件を自動拒否しました。',
      resetDenyCounts: '拒否カウンタをリセット',
      saved: '保存しました。',
      corruptionWarning:
        '保存された同意設定の一部が不正な形式だったため、デフォルト値に戻しました。意図しない設定変更がないか確認してください。',
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
    developer: {
      title: '開発者向け',
      description: 'PRF拡張対応の確認はデバッグ用途です。',
      checkPrf: 'PRF拡張対応確認',
      prfSupported: 'PRF拡張がサポートされています',
      prfUnsupportedTitle: 'PRF拡張がサポートされていません',
    },
    import: {
      title: '鍵情報でログイン',
      description: '以前にエクスポートした鍵情報ファイルまたはデータを使用してログインします。',
      fileSelect: '📁鍵情報ファイルを選択',
      dataInput: '鍵情報データを入力',
      dataPlaceholder: '鍵情報データをここに貼り付けてください',
      loginButton: '鍵情報データでログイン',
      processing: '処理中...',
      or: 'または',
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
    approveOnce: '今回のみ許可',
    alwaysAllow: '常に許可',
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
      metadata: 'プロフィール (metadata)',
      textNote: 'テキストノート',
      follows: 'フォローリスト',
      legacyDm: 'ダイレクトメッセージ（NIP-04 レガシー）',
      repost: 'リポスト',
      reaction: 'リアクション',
      channelMessage: 'チャンネルメッセージ',
      rumor: 'NIP-17 Rumor',
      seal: 'NIP-17 Seal',
      giftWrap: 'Gift Wrap',
      longForm: '長文記事',
      unknown: 'その他のイベント',
    },
    approveAndTrust: '常に許可して承認',
    openSettings: '同意設定を開く',
  },
  iframeHost: {
    running: 'Nosskey iframe が起動中です。親アプリからの署名リクエストを待機します。',
    noKey:
      '鍵が設定されていません。下のボタンからセットアップ画面を開き、パスキーで登録またはログインしてください。',
    partitionedWarning:
      'このサイトは別ドメインから埋め込まれています。鍵にアクセスするには、下のボタンを押してストレージアクセスを許可してください。',
    grantStorageAccess: 'ストレージアクセスを許可',
    storageAccessGranted: 'アクセスが許可されました。鍵を読み込みました。',
    storageAccessDenied:
      'ストレージアクセスが拒否されました。もう一度試すか、別タブで nosskey.app を開いてください。',
    storageAccessUnsupported: 'このブラウザは Storage Access API をサポートしていません。',
    retry: '再試行',
    partitionedTitle: 'ストレージアクセスの許可が必要です',
    deniedTitle: 'アクセスが拒否されました',
    grantedTitle: '許可されました',
    noKeyTitle: '鍵が見つかりません',
    unsupportedTitle: 'このブラウザは未対応です',
    openSetup: 'セットアップを開く',
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
    help: 'Help',
    errorMessages: {
      init: 'Initialization Error:',
      prfCheck: 'PRF Support Check Error:',
      passkeyCreation: 'Passkey Creation Error:',
      login: 'Login Error:',
    },
  },
  appWarning: {
    title: 'Important Notice',
    prfCompatibility: 'Some devices and environments are not supported.',
  },
  auth: {
    title: 'Nosskey',
    subtitle: 'Your Nostr account, with a passkey',
    createNew: 'Create New',
    loginWith: 'Login with Passkey',
    loading: 'Loading...',
    username: 'Username (Optional)',
    usernamePlaceholder: 'Enter username',
    firstLogin: 'First Login',
    passkeyCreated: 'Passkey Created Successfully',
    proceedWithLogin: 'Proceed with Login',
    tabLogin: 'Login',
    tabRegister: 'Sign Up',
    loginTip: 'Sign in again with a previously created passkey',
    registerTip:
      "Passkeys are a secure authentication method using biometrics or your device's security features. Even if your device doesn't directly support it, you can use your smartphone as an authenticator via QR code or browser notification.",
    usernameTip: 'Used as the display name for your passkey. Optional — you can leave it blank.',
  },
  nostr: {
    publicKey: 'Public Key',
    copyToClipboard: 'Copy to Clipboard',
    copiedToClipboard: 'Copied',
    profileAvatarAlt: 'Profile picture',
    profileFallbackAlt: 'No avatar',
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
      light: 'Light',
      dark: 'Dark',
      auto: 'Auto',
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
        'Sites and methods you marked as "always allow" in the consent dialog. Trust is recorded per method; other methods are confirmed separately. Removing an entry will make the dialog reappear on the next request.',
      empty: 'No trusted sites yet.',
      removeButton: 'Remove',
      removeAllButton: 'Remove',
      confirmRemove: 'Remove auto-approval for this method?',
      confirmRemoveAll: 'Remove auto-approval for this site entirely?',
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
      denyCount: 'Auto-rejected {count} request(s) this session.',
      resetDenyCounts: 'Reset deny counter',
      saved: 'Saved.',
      corruptionWarning:
        'Some stored consent settings were invalid and have been reset to defaults. Please verify your settings have not been altered unexpectedly.',
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
    developer: {
      title: 'For Developers',
      description: 'PRF extension support check is for debugging purposes.',
      checkPrf: 'Check PRF Extension Support',
      prfSupported: 'PRF extension is supported',
      prfUnsupportedTitle: 'PRF Extension Not Supported',
    },
    import: {
      title: 'Login with KeyInfo',
      description: 'Use a previously exported KeyInfo file or data to login.',
      fileSelect: '📁Select KeyInfo File',
      dataInput: 'Enter KeyInfo Data',
      dataPlaceholder: 'Paste your Key data here',
      loginButton: 'Login with Key Data',
      processing: 'Processing...',
      or: 'or',
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
    approveOnce: 'Allow once',
    alwaysAllow: 'Always allow',
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
      metadata: 'Profile (metadata)',
      textNote: 'Text note',
      follows: 'Follow list',
      legacyDm: 'Direct message (NIP-04 legacy)',
      repost: 'Repost',
      reaction: 'Reaction',
      channelMessage: 'Channel message',
      rumor: 'NIP-17 rumor',
      seal: 'NIP-17 seal',
      giftWrap: 'Gift wrap',
      longForm: 'Long-form article',
      unknown: 'Other event',
    },
    approveAndTrust: 'Approve and always allow',
    openSettings: 'Open consent settings',
  },
  iframeHost: {
    running: 'Nosskey iframe is running and waiting for signing requests from the parent app.',
    noKey:
      'No key configured. Use the button below to open the setup page, then register or sign in with a passkey.',
    partitionedWarning:
      'This page is embedded from a different domain. Grant storage access with the button below to reach your key.',
    grantStorageAccess: 'Grant storage access',
    storageAccessGranted: 'Access granted. Key loaded.',
    storageAccessDenied:
      'Storage access was denied. Retry, or open nosskey.app in another tab to create or unlock your key.',
    storageAccessUnsupported: 'This browser does not support the Storage Access API.',
    retry: 'Retry',
    partitionedTitle: 'Storage access required',
    deniedTitle: 'Access denied',
    grantedTitle: 'Access granted',
    noKeyTitle: 'No key found',
    unsupportedTitle: 'Browser not supported',
    openSetup: 'Open setup',
  },
};

// 言語ストアの型定義
export interface I18nStore {
  currentLanguage: Language;
  t: TranslationData;
}
