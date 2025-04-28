# Nosskey SDK サンプルアプリケーション

このアプリケーションは、Nosskey SDKを利用したPasskey（WebAuthn）ベースのNostr鍵管理デモです。PRF拡張の出力値を直接Nostrのシークレットキーとして使用する`directPrfToNostrKey`メソッドを実装しています。

## 技術スタック

- **フレームワーク**: Svelte v5
- **言語**: TypeScript
- **ビルドツール**: Vite
- **Nostr関連**: rx-nostr、rx-nostr-crypto
- **鍵管理**: Nosskey SDK

## 主な機能

- PRF拡張対応確認
- Passkey新規作成による鍵生成
- 既存Passkey認証によるログイン
- Nostrメッセージの作成と署名
- リレーへのメッセージ送信

## 動作要件

- `localhost`またはHTTPS環境での実行が必要
- Chrome 116以降または Safari 18以降推奨
- PRF拡張をサポートする認証器が必要:
  - Chromium 116+ + Google Password Manager Passkey
  - Chromium 116+ / Safari 18 + CTAP2セキュリティキー（YubiKey 5シリーズ等）
  - macOS 15・iOS 18以降のApple Passkeys (Touch ID / Face ID)
  - ※Windows Helloは2025年4月時点でPRF拡張未対応

PRF拡張対応の詳細は[こちら](../../docs/prf-support-tables.md)を参照してください。

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

このアプリケーションは下記の特徴を持っています：

1. WebAuthn PRF拡張を使用したシームレスなNostr鍵生成
2. 鍵の暗号化/復号が不要でシンプルな実装
3. 同じPasskeyから毎回同じNostr公開鍵を生成
4. 認証と署名が一体化したユーザー体験

## 構成

- `AuthScreen.svelte` - 認証画面コンポーネント
- `NostrScreen.svelte` - Nostrメッセージ投稿画面コンポーネント
- `appState.ts` - アプリケーション状態管理

## 制限事項

- WebAuthn PRF拡張は比較的新しい機能で、全てのブラウザや認証器で対応していない
- デモ実装のため、エラーハンドリングは基本的な実装にとどまっている

## TODO

- [x] リレー接続の実装強化（現在はシミュレーション程度）
- [ ] 簡易的なルーティング機能の実装（'/auth', '/nostr'など）
- [ ] モバイルファーストのフッターメニュー追加（画面遷移用）
- [ ] `importNostrKey`機能のサポート追加（現状は`directPrfToNostrKey`のみ）
- [ ] 多言語対応の実装（日本語・英語）
- [ ] タイムライン表示機能の追加（自分の投稿を確認可能に）
- [ ] リレー編集が可能な設定画面の追加
- [ ] ユーザーメタデータ（プロフィール）の編集・保存機能
- [ ] Vitestを使用したテスト実装（単体・統合テスト）
