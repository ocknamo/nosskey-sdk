export default {
  // 共通
  app_title: 'Nosskey SDK デモアプリ',
  home: 'ホーム',
  register: '新規登録',
  login: 'ログイン',
  nostr_features: 'Nostr機能',
  footer_copyright: '© 2025 Nosskey SDK Demo',

  // ホームページ
  home_title: 'Nosskey SDKサンプルアプリケーション',
  home_description:
    'このアプリケーションは、Nosskey SDKを使用してPasskeyベースのNostr鍵導出機能をデモするためのものです。',
  passkey_check_title: 'Passkey対応確認',
  checking_browser: 'ブラウザの対応状況を確認中...',
  passkey_supported:
    'このブラウザはPasskeyに対応しています！登録またはログインして機能を試すことができます。',
  passkey_not_supported:
    'このブラウザはPasskeyに対応していません。Passkey対応ブラウザ（Chrome、Firefox、Safari最新版など）を使用してください。',
  about_nosskey_title: 'Nosskey SDKについて',
  about_nosskey_description:
    'Nosskey SDKは、WebAuthn/Passkey技術を使用してNostr用の鍵ペアを安全に導出するためのライブラリです。これにより、ユーザーは生の秘密鍵を管理する必要なく、生体認証などの安全な方法でNostrアプリケーションにアクセスできます。',

  // 登録ページ
  register_title: 'Passkey新規登録',
  register_description:
    'ユーザーIDを入力して、このデバイスにPasskeyを登録します。登録後は同じIDでログインできるようになります。',
  user_id: 'ユーザーID',
  user_id_placeholder: '例: alice123',
  processing: '処理中...',
  register_passkey: 'Passkey登録',
  enter_user_id: 'ユーザーIDを入力してください',
  passkey_register_success: 'Passkeyの登録に成功しました！',
  passkey_register_failed: 'Passkeyの登録に失敗しました',
  registration_complete: '登録が完了しました。ログインページへ移動して認証を行ってください。',
  go_to_login: 'ログインページへ',
  error_occurred: 'エラーが発生しました',

  // ログインページ
  login_title: 'Passkey認証（ログイン）',
  login_description:
    '登録済みのユーザーIDを入力してPasskey認証を行います。認証が成功すると、Nostr機能を使用できるようになります。',
  passkey_auth: 'Passkey認証',
  login_success: 'ログインに成功しました！',
  derived_pubkey: '導出されたノストル公開鍵',
  try_nostr_features: 'Nostr機能を使用して、メッセージを送信してみましょう。',
  go_to_nostr: 'Nostr機能へ',

  // Nostr機能ページ
  nostr_title: 'Nostr機能',
  user_info: 'ユーザー情報',
  connected_relays: '接続リレー',
  message_sending: 'メッセージ送信',
  message_form_description: '以下のフォームからNostrメッセージを送信できます。',
  message: 'メッセージ',
  message_placeholder: '送信するメッセージを入力...',
  send_message: 'メッセージを送信',
  sending_message: '送信中...',
  enter_message: 'メッセージを入力してください',
  secret_key_missing: '秘密鍵が取得できていません。再度ログインしてください。',
  message_sent: 'メッセージを送信しました！（モックレスポンス）',
  logout: 'ログアウト',
  language: '言語',
};
