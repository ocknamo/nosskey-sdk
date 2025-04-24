# Nosskey SDK サンプルアプリケーション

このアプリケーションは、Nosskey SDKを使用してPasskeyベースのNostr鍵導出機能をデモするためのサンプルアプリケーションです。

## 機能

- Passkey対応確認
- ユーザー登録（Passkey生成）
- 鍵の導出（ログイン）
- 簡単なNostrメッセージの送信機能（モック）

## 開発環境のセットアップ

プロジェクトルートから以下のコマンドを実行します：

```bash
# 依存関係のインストール
cd examples/svelte-app
npm install

# 開発サーバーの起動
npm run dev
```

## 構成

このアプリケーションは以下のコンポーネントで構成されています：

- **ホームページ**: Passkey対応確認と概要説明
- **登録ページ**: 新規ユーザー登録とPasskey生成
- **ログインページ**: 既存ユーザーのログインと鍵導出
- **Nostr機能ページ**: 鍵情報の表示とメッセージ送信機能

## 注意点

- このアプリケーションはデモ目的のため、実際のリレーへの接続はモック化されています
- WebAuthn/Passkey機能はHTTPS環境か、localhostでのみ動作します

## Nosskey SDKとの連携

このアプリケーションは、ローカルの`nosskey-sdk`パッケージを使用しています。アプリケーションの実装を通じて、以下のSDK機能が使用されています：

- `Nosskey.isPasskeySupported()`: ブラウザのPasskey対応確認
- `nosskey.registerPasskey()`: 新規Passkey登録
- `nosskey.deriveKey()`: Passkey認証による鍵導出
- `Nosskey.toHex()`: バイナリ→16進変換ユーティリティ

詳細な実装は各コンポーネントのソースコードを参照してください。
