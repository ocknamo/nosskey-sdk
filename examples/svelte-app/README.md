# Nosskey SDK サンプルアプリケーション

[nosskey.app](https://nosskey.app/)

このアプリケーションは、Nosskey SDKを利用したPasskey（WebAuthn）ベースのNostr鍵管理デモです。
PRF拡張の出力値を直接Nostrのシークレットキーとして使用する方法と既存のNostr鍵をPRF値で暗号化する方法を実装しています。

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

- [設計](svelte-app-design.md)

## 制限事項

- WebAuthn PRF拡張は比較的新しい機能で、全てのブラウザや認証器で対応していない
- Nostrクライアントとしての機能は限定的

## TODO

### 最高優先度（SDK関連・クリティカルな問題）
- [x] シークレットキーのキャッシュ問題を修正する。（TTL期間内でも毎回認証が必要になっている問題）
- [x] SDK起因のバグを修正する。（キャッシュなど）
- [x] SDKのインターフェースを再検討する。（pwkとprf directの統一性、公開鍵の保持など）
- [x] PWKManagerをシングルトンにする（キャッシュ設定に一貫性を持たせるため）
- [x] 秘密鍵インポート機能の動作を確認する。
- [x] デフォルトのリレーが初期設定されていない問題を修正する。
- [x] SDKにPWK保存機能をつける(optionに追加してデフォルト有効にする。NIP-07に合わせてsignEvent, getPublicKeyメソッドを追加。拡張性のためgetCurrentPWKメソッドも追加。PWKを使っているメソッドにPWKなしでも使えるようにしておくPWKがなかったらエラー)

### 高優先度（重要なUX改善とセキュリティ）
- [x] インポート→戻るを押すとホワイトアウトする問題を修正する。
- [x] `authenticated`変数を`isLoggedIn`など意味がより明確な変数名に変更する。
- [x] `nosskey_credential_ids`の保管と表示をやめる。
- [x] 認証関係（登録、ログイン）のユースケースと動線をわかりやすく改善する。
- [x] 既存のパスキーで作成済みPRFダイレクトアカウントにPWKなしでログインする動線を追加する。

### 中優先度（基本機能強化）
- [x] デモアプリとドメイン変更に関する注意喚起の説明文を追加する。
- [x] i18n対応の漏れを修正する。
- [x] ログアウトレベルを段階化する。（軽量/標準/完全の3段階）
- [x] ログアウト時にシークレットのキャッシュを削除する
- [x] プロフィール表示の問題を修正する。
- [x] npubとnsecのフォーマットで表示・コピー・インポート機能を実装する。
- [ ] 未認証状態でもタイムライン表示を可能にする。（デフォルトのTL、パブキーに対するTL）
- [ ] 他のユーザをフォローする機能
- [ ] 複数アカウント対応
- [x] インポート鍵PWK喪失状態からの再ログイン（復元）機能。設定画面からのPWKのエクスポート機能。
- [ ] リレーへのPWKバックアップ機能。
- [ ] 画面遷移時にスクロールトップに移動させる

### 低優先度（機能拡張・検証）
- [ ] パスキー作成が必要なケースの案内を追加する。
- [ ] フォローの投稿をタイムラインに表示する機能を実装する。
- [ ] 秘密鍵紛失時の回復方法についての説明を追加する。
- [x] Vitestを使用したテストを実装する。（単体・統合テスト）
- [x] Utils系の関数にテストを追加
- [ ] アプリケーション情報にcommit hashを追加
- [ ] Windows（Edge）での動作をテストする。
- [x] ビットワーデンの対応可否を確認する。
- [ ] プロフィールの表示と編集を分離する
- [ ] Setting画面が肥大化しているのでセクションごとにコンポーネントに切り出す


## ログイン状態の定義

本アプリケーションでは、「PWKBlobが存在すること」をログイン状態と定義しています。この定義の利点は以下の通りです：

- 同じパスキーと同じusernameやsaltを使用すれば、PWKBlobを失った場合でも復元可能
- 状態の判定基準が単一の条件（PWKBlobの存在）で完結するため、実装が単純化される

詳細な設計については[svelte-app-design.md](svelte-app-design.md)を参照してください。
