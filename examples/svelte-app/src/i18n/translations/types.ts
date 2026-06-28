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
      importNsec: string;
      prfUnsupported: string;
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
    tabLogin: string;
    tabRegister: string;
    usernameTip: string;
    methodImport: string;
    nsecLabel: string;
    nsecPlaceholder: string;
    nsecTip: string;
    importNsec: string;
    invalidNsec: string;
    accounts: {
      title: string;
      relogin: string;
      delete: string;
      confirmDelete: string;
      cancel: string;
    };
    wrapBackup: {
      title: string;
      description: string;
      warning: string;
      saveButton: string;
      saveAgain: string;
      saved: string;
      continue: string;
      later: string;
    };
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
      repository: string;
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
      purpleDark: string;
      purpleLight: string;
      neutralDark: string;
      neutralLight: string;
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
        connect: string;
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
      decryptTip: string;
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
    titleConnect: string;
    titleEncrypt: string;
    titleDecrypt: string;
    connectDescription: string;
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
      getPublicKey: string;
      getRelays: string;
      signEvent: string;
      nip44Encrypt: string;
      nip44Decrypt: string;
      nip04Encrypt: string;
      nip04Decrypt: string;
    };
    peerPubkey: string;
    plaintext: string;
    decryptNoPreview: string;
    decryptAlwaysAsk: string;
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

// 言語ストアの型定義
export interface I18nStore {
  currentLanguage: Language;
  t: TranslationData;
}
