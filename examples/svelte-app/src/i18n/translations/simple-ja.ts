import type { DeepPartial, TranslationData } from './types.js';

// シンプルモード（日本語）: Nostr の専門用語（公開鍵・秘密鍵・nsec・リレー・署名・NIP など）を
// 一般ユーザー向けの表現に置き換える部分オーバーレイ。
// ここに定義のないキーは ja.ts の標準文言にフォールバックする。
export const simpleJa: DeepPartial<TranslationData> = {
  common: {
    errorMessages: {
      importNsec: 'アカウント引き継ぎエラー:',
    },
  },
  auth: {
    methodImport: '既存アカウントを引き継ぐ（ベータ版）',
    nsecLabel: 'リカバリーキー',
    nsecTip:
      '別の Nostr アプリで使っていたリカバリーキー（nsec1... で始まる文字列）を入力すると、そのアカウントをこのアプリで使えます。キーはパスキーで暗号化されて安全に保存されます。',
    invalidNsec:
      'リカバリーキーの形式が正しくありません。"nsec1..." で始まる文字列を入力してください。',
    noKeyInfoTitle: 'この端末にアカウント情報が見つかりませんでした',
    noKeyInfoDescription:
      'このパスキーに紐づくアカウント情報がこの端末に残っていません。以前のアカウントで入る場合は、バックアップしたアカウント情報から復元してください。パスキーから復元すると、リカバリーキーで引き継いだアカウントとは別のアカウントになります。',
    deriveFromPasskey: 'このパスキーからアカウントを復元して入る',
  },
  nostr: {
    publicKey: 'ユーザーID',
  },
  key: {
    title: 'バックアップ',
  },
  settings: {
    exportSecretKey: 'リカバリーキーのエクスポート',
    exportSecretKeyWarning:
      '警告：リカバリーキーは誰とも共有しないでください。リカバリーキーを持つ人はあなたのアカウントを完全に制御できます。',
    showExportSection: 'エクスポートを表示',
    hideExportSection: 'エクスポートを隠す',
    exportWarningFinal:
      '最終警告：このリカバリーキーを共有すると、あなたのアカウントが乗っ取られる可能性があります。必ずバックアップ目的でのみ使用してください。',
    confirmExport: 'エクスポートする',
    yourSecretKey: 'あなたのリカバリーキー：',
    noKeyToExport: 'エクスポートするリカバリーキーがありません。ログイン状態を確認してください。',
    localStorage: {
      title: 'この端末に保存されたデータ',
      cleared: 'この端末に保存されたデータをクリアしました',
    },
    cacheSettings: {
      title: '再認証の間隔',
      description:
        '認証を一定時間記憶して、操作のたびの再認証をスキップできます。記憶する時間を長くすると、その分アカウントを不正利用されるリスクが高まります。',
      enabled: '認証を一定時間記憶する',
      disabled: '毎回認証する',
      timeoutLabel: '記憶する時間（秒）',
      clearTitle: '記憶した認証のクリア',
      clearDescription: '記憶している認証をクリアします。次回の操作時に再認証が必要になります。',
      clearButton: '認証をクリア',
      clearSuccess: '記憶した認証をクリアしました。',
      clearError: '認証のクリアに失敗しました。',
    },
    relays: {
      title: '接続先サーバー',
      description:
        'このアカウントが使う接続先サーバーの一覧です。連携するアプリがこの一覧を参照します。',
      empty: '接続先サーバーが登録されていません。',
    },
    consentPolicy: {
      methodLabel: {
        connect: 'サイト接続（ユーザーID・接続先サーバーの読み取り）',
        signEvent: '投稿の承認',
        nip44: 'メッセージの暗号化（標準方式）',
        nip04: 'メッセージの暗号化（旧方式）',
      },
      decryptTip:
        '安全のため、メッセージを読む（復号する）操作は「常に許可」にしても毎回確認します。「常に許可」はそれ以外の操作にのみ適用されます。',
    },
    exportKeyInfo: {
      title: 'アカウントのバックアップ',
      description:
        'アカウントをバックアップして別のデバイスで利用したり、ブラウザデータが消去された場合に復元することができます。',
      warning:
        '注意: このバックアップを紛失するとアカウントへのアクセスができなくなる場合があります。安全な場所に保管してください。',
      showExportSection: 'バックアップを作成',
      hideExportSection: 'バックアップの作成を隠す',
      restoreWarning:
        'このバックアップファイルは、同じパスキーと同じユーザー名でログインできない場合の復元に使用できます。',
      exportButton: 'バックアップを作成',
      backupData: 'バックアップデータ:',
      noCurrentKeyInfo: '現在のアカウント情報が見つかりません。ログイン状態を確認してください。',
    },
    import: {
      title: 'バックアップから復元',
      description: '以前に作成したバックアップファイルまたはデータを使用してログインします。',
      fileSelect: '📁バックアップファイルを選択',
      dataInput: 'バックアップデータを入力',
      dataPlaceholder: 'バックアップデータをここに貼り付けてください',
      loginButton: 'バックアップデータでログイン',
    },
  },
  navigation: {
    key: 'バックアップ',
  },
  consent: {
    title: 'このサイトからのリクエスト',
    titleConnect: 'このサイトからの接続リクエスト',
    titleEncrypt: 'メッセージの暗号化リクエスト',
    titleDecrypt: 'メッセージを読むリクエスト',
    connectDescription:
      'このサイトはあなたのユーザーIDと接続先サーバーの設定を読み取れるようになります。',
    eventKind: '内容の種類',
    method: 'リクエストの種類',
    plaintext: 'メッセージの内容',
    decryptNoPreview: 'メッセージの内容は読み込んだ後にしか確認できません。',
    methodLabel: {
      getPublicKey: 'ユーザーIDの取得',
      getRelays: '接続先サーバーの読み取り',
      signEvent: '投稿の承認',
      nip44Encrypt: 'メッセージを暗号化',
      nip44Decrypt: 'メッセージを読む（復号）',
      nip04Encrypt: 'メッセージを暗号化（旧方式）',
      nip04Decrypt: 'メッセージを読む（旧方式）',
    },
    peerPubkey: '相手のユーザーID',
    showRaw: '技術的な詳細を表示',
    kindLabel: {
      metadata: 'プロフィール',
      textNote: '投稿',
      legacyDm: 'ダイレクトメッセージ（旧方式）',
      rumor: '非公開メッセージ（内部データ）',
      seal: '非公開メッセージ（内部データ）',
      giftWrap: '非公開メッセージ（内部データ）',
      unknown: 'その他の内容',
    },
  },
};
