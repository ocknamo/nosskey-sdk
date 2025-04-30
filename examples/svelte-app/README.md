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
- [x] パスキー作成時にusernameを入力できる機能
- [x] 一度ログインしたらPWKの値をローカルストレージに保管する。保管されている場合はPRF拡張の対応確認はスキップする。
- [x] 簡易的なルーティング機能の実装（'/auth', '/nostr'など）
- [x] モバイルファーストのフッターメニュー追加（画面遷移用）
- [x] `importNostrKey`機能のサポート追加（現状は`directPrfToNostrKey`のみ）
- [x] リレー編集が可能な設定画面の追加
- [x] 設定画面にローカルストレージのクリアボタンを作成
- [x] 多言語対応の実装（日本語・英語）と設定画面に切替機能を作成
- [x] 設定画面にシークレットのキャッシュ設定を追加
- [x] タイムライン表示機能の追加（自分の投稿を確認可能に）
- [x] ユーザーメタデータ（プロフィール）の編集・保存機能
- [ ] Vitestを使用したテスト実装（単体・統合テスト）
- [ ] ログアウトレベルの段階化（軽量/標準/完全の3段階）
- [ ] `authenticated`変数を`isLoggedIn`など意味がより明確な変数名に変更
- [ ] `nosskey_credential_ids`の保管と表示をやめる

## ログイン状態の定義

本アプリケーションでは、「PWKBlobが存在すること」をログイン状態と定義しています。この定義の利点は以下の通りです：

- 同じパスキーと同じusernameを使用すれば、PWKBlobを失った場合でも復元可能
- 状態の判定基準が単一の条件（PWKBlobの存在）で完結するため、実装が単純化される

詳細な設計については[svelte-app-design.md](svelte-app-design.md)を参照してください。

## 今後の改善予定

### 1. ログアウトレベルの段階化

異なるレベルのログアウトオプションを提供する予定です：

- **軽量ログアウト**: 一時的にキャッシュのみクリア
- **標準ログアウト**: PWKBlobとキャッシュをクリア
- **完全ログアウト**: すべてのデータとパスキーを削除

### 2. 変数名の改善

`authenticated`という変数名は意味が広く分かりにくいため、より明確な`isLoggedIn`などへの変更を検討しています。
