# nosskey-sdk
SDK for Passkey-Derived Nostr Identity a.k.a. Nosskey

## サンプルアプリケーション

`examples/svelte-app`ディレクトリにサンプルアプリケーションがあります。このアプリケーションは、Nosskey SDKの機能を活用して、PasskeyとNostrを組み合わせたデモを提供します。

### ログイン状態の定義

サンプルアプリでは、「PWKBlobが存在すること」をログイン状態と定義しています。この定義の利点は以下の通りです：

- 同じパスキーと同じusernameを使用すれば、PWKBlobを失った場合でも復元可能
- 状態の判定基準が単一の条件（PWKBlobの存在）で完結するため、実装が単純化される

詳細な設計については[svelte-app-design.md](examples/svelte-app/svelte-app-design.md)を参照してください。

## 今後の改善予定

### 1. ログアウトレベルの段階化

異なるレベルのログアウトオプションを提供する予定です：

- **軽量ログアウト**: 一時的にキャッシュのみクリア
- **標準ログアウト**: PWKBlobとキャッシュをクリア
- **完全ログアウト**: すべてのデータとパスキーを削除

### 2. 変数名の改善

`authenticated`という変数名は意味が広く分かりにくいため、より明確な`isLoggedIn`などへの変更を検討しています。
