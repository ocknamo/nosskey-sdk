import type { DeepPartial, TranslationData } from './types.js';

// Simple mode (English): partial overlay that replaces Nostr jargon
// (public key, secret key, nsec, relay, sign, NIP, ...) with plain wording.
// Keys not defined here fall back to the standard strings in en.ts.
export const simpleEn: DeepPartial<TranslationData> = {
  common: {
    errorMessages: {
      importNsec: 'Account Transfer Error:',
    },
  },
  auth: {
    methodImport: 'Bring your existing account (Beta)',
    nsecLabel: 'Recovery key',
    nsecTip:
      'Enter the recovery key (a string starting with nsec1...) from another Nostr app to use that account here. The key is encrypted with your passkey and stored safely.',
    invalidNsec: 'Invalid recovery key. Please enter a string starting with "nsec1...".',
  },
  nostr: {
    publicKey: 'User ID',
  },
  key: {
    title: 'Backup',
  },
  settings: {
    exportSecretKey: 'Export Recovery Key',
    exportSecretKeyWarning:
      'Warning: Never share your recovery key with anyone. Anyone with your recovery key can fully control your account.',
    showExportSection: 'Show Export',
    hideExportSection: 'Hide Export',
    exportWarningFinal:
      'Final Warning: Sharing this recovery key can lead to your account being compromised. Use only for backup purposes.',
    confirmExport: 'Export',
    yourSecretKey: 'Your Recovery Key:',
    noKeyToExport: 'No recovery key to export. Please check your login status.',
    localStorage: {
      title: 'Data on This Device',
      cleared: 'Data on this device cleared',
    },
    cacheSettings: {
      title: 'Re-authentication Interval',
      description:
        'Remember your authentication for a while so you can skip re-authenticating on every operation. Longer durations increase the risk of unauthorized use of your account.',
      enabled: 'Remember authentication for a while',
      disabled: 'Authenticate every time',
      timeoutLabel: 'Remember for (seconds)',
      clearTitle: 'Forget Remembered Authentication',
      clearDescription:
        'Forget the remembered authentication. You will need to re-authenticate on the next operation.',
      clearButton: 'Forget Now',
      clearSuccess: 'Remembered authentication has been cleared.',
      clearError: 'Failed to clear remembered authentication.',
    },
    relays: {
      title: 'Servers',
      description: 'The servers this account connects to. Connected apps read this list.',
      empty: 'No servers configured.',
    },
    consentPolicy: {
      methodLabel: {
        connect: 'Site connection (read user ID & servers)',
        signEvent: 'Approve posts',
        nip44: 'Message encryption (standard)',
        nip04: 'Message encryption (legacy)',
      },
      decryptTip:
        'For safety, reading (decrypting) messages always prompts even when set to "Always allow". "Always allow" applies only to other operations.',
    },
    exportKeyInfo: {
      title: 'Account Backup',
      description:
        'Back up your account to use it on another device or restore it if your browser data is erased.',
      warning:
        'Warning: Losing this backup may result in loss of access to your account. Store it in a safe place.',
      showExportSection: 'Create Backup',
      hideExportSection: 'Hide Backup',
      restoreWarning:
        'This backup file can be used for recovery when you cannot login with the same passkey and the same username.',
      exportButton: 'Create Backup',
      backupData: 'Backup Data:',
      noCurrentKeyInfo: 'Current account data not found. Please check your login status.',
    },
    import: {
      title: 'Restore from Backup',
      description: 'Use a previously created backup file or data to login.',
      fileSelect: '📁Select Backup File',
      dataInput: 'Enter Backup Data',
      dataPlaceholder: 'Paste your backup data here',
      loginButton: 'Login with Backup Data',
    },
  },
  navigation: {
    key: 'Backup',
  },
  consent: {
    title: 'Request from this site',
    titleConnect: 'Connection request from this site',
    titleEncrypt: 'Message encryption request',
    titleDecrypt: 'Read message request',
    connectDescription: 'This site will be able to read your user ID and server settings.',
    eventKind: 'Type of content',
    method: 'Request type',
    plaintext: 'Message content',
    decryptNoPreview: 'The message content can only be seen after it is read.',
    methodLabel: {
      getPublicKey: 'Read user ID',
      getRelays: 'Read server list',
      signEvent: 'Approve post',
      nip44Encrypt: 'Encrypt message',
      nip44Decrypt: 'Read message (decrypt)',
      nip04Encrypt: 'Encrypt message (legacy)',
      nip04Decrypt: 'Read message (legacy)',
    },
    peerPubkey: "Peer's user ID",
    showRaw: 'Show technical details',
    kindLabel: {
      metadata: 'Profile',
      textNote: 'Post',
      legacyDm: 'Direct message (legacy)',
      rumor: 'Private message (internal)',
      seal: 'Private message (internal)',
      giftWrap: 'Private message (internal)',
      unknown: 'Other content',
    },
  },
};
