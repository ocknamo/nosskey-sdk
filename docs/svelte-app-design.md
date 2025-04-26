# Nosskey SDK サンプルアプリケーション設計書

## 1. 概要

このドキュメントは、Nosskey SDKを利用したサンプルアプリケーションの設計と実装詳細を記述しています。このアプリケーションは、Passkey（WebAuthn）を利用したNostr鍵ラップの仕組みをデモンストレーションするために作成されました。特に、PRF拡張の出力値を直接Nostrのシークレットキーとして使用する`directPrfToNostrKey`メソッドに焦点を当てています。

## 2. アプリケーション構成

### 2.1 技術スタック

- **フロントエンド**: Svelte v5
- **構成**: シンプルなSPA（コンポーネント切り替え方式）
- **ビルドツール**: Vite
- **Nostr関連**: rx-nostr
- **鍵管理**: Nosskey SDK (`directPrfToNostrKey` メソッド)
- **スタイリング**: カスタムCSS

### 2.2 プロジェクト構造

```
examples/svelte-app/
├── public/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Header.svelte     # ヘッダーとナビゲーションメニュー
│   │   │   ├── Footer.svelte     # フッター情報
│   │   │   ├── NostrForm.svelte  # Nostrメッセージ投稿フォーム
│   │   │   └── PasskeyStatus.svelte # Passkey対応状況表示
│   │   └── stores/
│   │       ├── app-store.js      # 画面状態管理
│   │       └── nosskey-store.js  # Nosskey SDK関連の状態管理
│   ├── views/
│   │   ├── HomeView.svelte       # ホーム画面
│   │   ├── RegisterView.svelte   # パスキー登録画面
│   │   ├── LoginView.svelte      # ログイン画面
│   │   └── NostrView.svelte      # Nostr投稿画面
│   ├── App.svelte                # メインアプリコンポーネント
│   └── main.js                   # エントリーポイント
├── index.html
├── package.json
└── vite.config.js
```

## 3. コンポーネント詳細

### 3.1 状態管理

#### app-store.js
シンプルな画面遷移管理を行うストア：
- `currentView` - 現在のビュー名を保持するwritableストア
- `navigateTo()` - 画面遷移を行う関数

#### nosskey-store.js
Nosskey SDKとの連携を行う中心的なストア：
- `pwkManager` - PWKManagerインスタンス
- `isSupported` - Passkey PRF拡張対応状況
- `credentialId`, `pwkBlob`, `publicKey` - 認証情報
- `isAuthenticated` - 認証状態（derivedストア）
- `checkSupport()` - PRF拡張対応確認
- `registerDirectPrf()` - Passkey登録とPRF直接利用
- `loadSavedCredentials()` - 保存済み認証情報読み込み
- `signNostrEvent()` - Nostrイベント署名
- `clearCredentials()` - 認証情報クリア

### 3.2 ビューコンポーネント

#### HomeView.svelte
- アプリケーションの目的と特徴の説明
- PRF拡張対応状況の表示
- パスキー登録画面への誘導

#### RegisterView.svelte
- パスキー作成と直接PRF利用の説明
- パスキー登録処理
- 登録結果（公開鍵）の表示

#### LoginView.svelte
- 保存された認証情報の読み込み
- 自動ログイン処理

#### NostrView.svelte
- ユーザー情報（公開鍵）の表示
- メッセージ投稿フォーム
- ログアウト機能

### 3.3 コンポーネント

#### Header.svelte
- タイトル表示
- ナビゲーションメニュー（認証状態に応じた表示切替）

#### Footer.svelte
- アプリケーション情報
- リポジトリリンク

#### PasskeyStatus.svelte
- Passkey PRF拡張対応状況表示

#### NostrForm.svelte
- メッセージ入力フォーム
- 送信処理（署名と送信）
- エラー/成功メッセージ表示

## 4. データフロー

1. アプリ起動時にPRF拡張対応状況を確認（`checkSupport()`）
2. 保存済み認証情報があれば読み込み（`loadSavedCredentials()`）
3. パスキー登録時：
   - パスキー作成（`createPasskey()`）
   - PRF値から直接シークレットキー導出（`directPrfToNostrKey()`）
   - 結果をストアとlocalStorageに保存
4. Nostrメッセージ投稿時：
   - イベント作成
   - パスキーによる署名（`signNostrEvent()`）
   - リレーへの送信

## 5. 技術的考慮事項

### 5.1 WebAuthn/Passkey対応

- `localhost`または`HTTPS`環境での実行が必要
- Chrome または Safari最新版での動作を想定
- PRF拡張をサポートする認証器（YubiKey等）が必要

### 5.2 PRF直接使用の利点

- 鍵の暗号化/復号が不要でシンプル
- 毎回同じパスキーを使えば同じ公開鍵が生成される
- ユーザー体験の向上（認証と署名が一体化）

### 5.3 制限事項

- WebAuthn PRF拡張は比較的新しい機能で、全てのブラウザや認証器で対応していない
- デモ実装のため、エラーハンドリングが簡素化されている
- 複数アカウント管理などの高度な機能は未実装

## 6. 開発・実行方法

```bash
# リポジトリのクローン
git clone https://github.com/ocknamo/nosskey-sdk.git
cd nosskey-sdk

# 依存関係のインストールとビルド
npm install
npm run build

# サンプルアプリの依存関係インストール
cd examples/svelte-app
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:5173 にアクセスしてアプリケーションを利用できます。
