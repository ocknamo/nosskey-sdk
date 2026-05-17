# Nosskey SDK サンプルアプリケーション

[nosskey.app](https://nosskey.app/)

このアプリケーションは、Nosskey SDKを利用したPasskey（WebAuthn）ベースのNostr鍵管理デモです。
PRF拡張の出力値を直接Nostrのシークレットキーとして使用する方法と、既存のNostr鍵をPRF値で暗号化（PWK）する方法を実装しています。
また `#/iframe` ルートでは、別オリジンのNostrアプリへ署名機能を提供するiframe署名プロバイダとしても動作します。

## 技術スタック

- **フレームワーク**: Svelte v5
- **言語**: TypeScript
- **ビルドツール**: Vite
- **鍵管理**: Nosskey SDK (`nosskey-sdk`)
- **iframe 連携**: `nosskey-iframe`

## 主な機能

- PRF拡張対応確認
- Passkey新規作成による鍵生成
- 既存Passkey認証によるログイン
- KeyInfo（PWKデータ）・秘密鍵のエクスポート／インポート
- iframe署名プロバイダモード（`#/iframe`）— 別オリジンのNostrアプリへNIP-07メソッドを提供
- iframe同意ポリシー・信頼済みオリジンの設定

## 動作要件

- `localhost`またはHTTPS環境での実行が必要
- Chrome 118以降または Safari 18以降推奨
- PRF拡張をサポートする認証器が必要:
  - Chromium 118+ + Google Password Manager Passkey
  - Chromium 118+ + CTAP2セキュリティキー（YubiKey 5シリーズ等）
  - macOS 15・iOS 18以降のApple Passkeys (Touch ID / Face ID)
  - ※Windows Helloは近年のWindows（WebAuthnプラットフォームAPI `WEBAUTHN_API_VERSION_8`）と対応ブラウザ（Chrome 147+ / Firefox 148+ 等）の組み合わせでPRF拡張に対応（対応開始ビルドの詳細は要実機確認）

PRF拡張対応の詳細は[こちら](../../docs/ja/prf-support-tables.ja.md)を参照してください。

## 開発・実行方法

```bash
# リポジトリのクローン（既にクローン済みの場合は不要）
git clone https://github.com/ocknamo/nosskey-sdk.git
cd nosskey-sdk

# SDKのビルド（初回のみ）
npm install
npm run build

# サンプルアプリの依存関係インストール
cd examples/svelte-app
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:5173 にアクセスしてアプリケーションを利用できます。

## 技術的詳細

- [設計](svelte-app-design.md)
- [iframe ホスト機能の解説](../../docs/ja/iframe-host.ja.md) — `#/iframe` ルートで動作する署名プロバイダ iframe モードの仕組み

## 制限事項

- WebAuthn PRF拡張は比較的新しい機能で、全てのブラウザや認証器で対応していない
- Nostrクライアントとしての機能は限定的

## TODO

詳細なTODOリストは[TODO.md](TODO.md)を参照してください。


## ログイン状態の定義

本アプリケーションでは、「NostrKeyInfoが存在すること」をログイン状態と定義しています。この定義の利点は以下の通りです：

- 同じパスキーと同じusernameやsaltを使用すれば、NostrKeyInfoを失った場合でも復元可能
- 状態の判定基準が単一の条件（NostrKeyInfoの存在）で完結するため、実装が単純化される

詳細な設計については[svelte-app-design.md](svelte-app-design.md)を参照してください。
