# Nosskey SDK サンプルアプリケーション TODO

## Context

本リストはサンプルアプリ (`examples/svelte-app`) 固有の未完了 TODO を **優先度ベース (P0–P3)** で整理する。SDK 本体・iframe パッケージ・リリース全体に関わる項目は `docs/todo.md` 側に集約しているため、両者を併せて参照すること。

優先度の付け方は `docs/todo.md` と同じ:
- **P0**: 初期リリース必須
- **P1**: リリース前に強く推奨
- **P2**: 中期で取り組む
- **P3**: 長期・将来

---

## P0: 初期リリース必須

該当項目なし — リリースブロッカーは `docs/todo.md` の P0 セクションを参照。

## P1: リリース前に強く推奨

該当項目なし — 「ログアウト後の wrap モード鍵で再ログイン」はアーカイブ参照（PR #94 で対応済み）。

## P2: 中期で取り組む

- [ ] **「鍵情報をエクスポート」が動作しないバグの修正** — 設定画面の鍵情報エクスポートが動作していない。原因は `examples/svelte-app/src/components/settings/ExportKeyInfoComponent.svelte:44` で `JSON.stringify(exportKeyInfo, null, 2)` と **関数 `exportKeyInfo` 自身**を直列化しており、`currentKeyInfo`（32 行目で取得済み）を渡せていないこと。`JSON.stringify(currentKeyInfo, null, 2)` に修正する。修正後はインポート側（`ImportKeyInfo.svelte`）との往復で検証すること。
- [ ] **新規パスキー作成時にパスキー認証が 2 回要求される問題の調査・修正** — 新規作成タブは `createNew()`（`AuthScreen.svelte` の `createPasskey()` = WebAuthn `create`）でパスキー作成後、成功画面で改めて「ログイン」ボタン → `login(credentialId)`（`createNostrKey()` = WebAuthn `get`/PRF）を押す 2 ステップ。既存 nsec インポート経路（`importExisting()` → `createPasskey()` → `importNostrKey()`）は `createPasskey` 時の PRF が `#pendingPrfByCredId` にキャッシュされ消費されるため UV 1 回・1 ステップで完了する。新規作成側でも create 時の標準 salt PRF を消費して 2 回目の `get` を省けるか（＝ create→createNostrKey を 1 ボタンに統合できるか）を検証する。`createPasskey` が PRF 結果を返さないブラウザがある場合はフォールバックが必要なので、ブラウザ依存の切り分けも行う。
- [ ] **テーマを 2 種類から 4 種類に増やす** — 現状 `ThemeMode = 'light' | 'dark' | 'auto'`（`app-state.ts:59`。実テーマは light/dark の 2 種、auto は OS 追従）。選択可能なカラーテーマを 4 種類に拡張する。`ThemeMode` 型・`currentTheme` ストア・`loadThemeSetting()`（`app-state.ts:131` の許容値チェック）・テーマ適用ロジック・CSS variables（テーマ別カラーセット）・`theme-settings.svelte` の UI・i18n ラベル・iframe へ渡す `?theme=` クエリパラメータ（`NosskeyIframeClient` / `buildIframeUrl` と受信側 `app-state.ts:222`）の許容値もあわせて更新が必要。
- [ ] **テストの充実** — Vitest の追加導入は完了済み (`vitest.config.ts` 等)。今後は store / service レイヤと画面遷移のカバレッジ拡充。
- [ ] **複数アカウント対応（UI 側責務）** — 複数パスキーを切り替えて使える UI と内部状態管理。SDK/iframe 側の `switchKey` API は `docs/todo.md` の Phase 4-A が所有。本項目は API 完成後にそれを呼び出すサンプルアプリ側の画面実装。
- [ ] **より詳細な攻撃ベクトルの検討とリスク評価** — 同意ポリシー / 信頼済みオリジン / iframe 周りの再評価。

## P3: 長期・将来

- [ ] **新規登録タブのラベルを簡潔にする** — 「パスキーを新規作成」「既存 nsec をインポート（ベータ版）」が冗長。「新規作成」「インポート（ベータ版）」程度に短縮する（`AuthScreen.svelte` の `methodNew` / `methodImport` タブ、i18n ja/en）。
- [ ] **削除ボタンをゴミ箱アイコンに統一する** — PR #94 で保存済みアカウント一覧の削除は Material のゴミ箱アイコン（`IconButton` + `delete-icon.svg`）化済み。他の削除系ボタン（設定の信頼済みオリジン削除・リレー削除等のテキストボタン）も同じゴミ箱アイコンに揃える。
- [ ] **秘密鍵紛失時の回復方法についての説明を追加する**
- [ ] **Windows（Edge）での動作をテストする**
- [ ] **Windows についての注意書きを追加する**
- [ ] **動画によるチュートリアル**

---

## アーカイブ

### P1（リリース前推奨）
- [x] **ログアウト後の wrap モード鍵で再ログインできるようにする** — PR #94 で対応。ログアウトを「current ポインタ（`nosskey_pwk`）＋派生キャッシュのみ消去」に変更し、別キー `nosskey_accounts` のアプリ内マルチアカウント登録簿（`store/accounts.ts`: upsert/remove/list ＋ salt 正規化 ＋ 既存 current 鍵の一度きり移行）は保持するようにした。これにより wrap モード鍵（暗号化 nsec が localStorage にしか無い）も失われず再ログイン可能。`logout()` 後は `hasKeyInfo()` が false になり無言の自動ログインを防止。`loginWith()`（新規作成 / nsec インポート / KeyInfo ファイルインポート / 保存済みアカウント再ログインの共通活性化経路）で復元。`SavedAccounts.svelte` がログインタブ上部に保存済みアカウント一覧（再ログイン＋5秒キャンセル可能な削除）を表示。影響ファイル: `store/accounts.ts`（新規）・`store/app-state.ts`・`components/SavedAccounts.svelte`（新規）・`components/screens/AuthScreen.svelte`・`components/settings/ImportKeyInfo.svelte`。`accounts.spec.ts` 追加。

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
- [x] 認証画面の情報の整理
- [x] 認証画面のカードデザインへの統一

### 中優先度（基本機能強化）
- [x] 画面遷移時にスクロールトップに移動させる
- [x] デモアプリとドメイン変更に関する注意喚起の説明文を追加する。
- [x] i18n対応の漏れを修正する。
- [x] ログアウトレベルを段階化する。（軽量/標準/完全の3段階）
- [x] ログアウト時にシークレットのキャッシュを削除する
- [x] プロフィール表示の問題を修正する。
- [x] npubとnsecのフォーマットで表示・コピー・インポート機能を実装する。
- [x] 未認証状態でもタイムライン表示を可能にする。（デフォルトのTL、パブキーに対するTL）
- [x] インポート鍵PWK喪失状態からの再ログイン（復元）機能。設定画面からのPWKのエクスポート機能。
- [x] ローカルストレージ削除時にログアウト
- [x] アカウント画面の表示をリッチにする
- [x] プロフィールの表示と編集を分離する
- [x] TLの表示もマシにする
- [x] ボタンの色などを改善
- [x] アプリ設定とコアなアカウント設定を分けたい
- [x] ユーザのアイコン画像をカードに表示 — `PublicKeyDisplay.svelte` に丸型アバターを追加。`services/profile-fetcher.ts`(ネイティブ WebSocket で kind:0 を REQ/EVENT/EOSE 取得、複数リレー並列＋created_at 最大採用＋タイムアウト)、`services/profile-cache.ts`(localStorage `nosskey_profile_cache`、`isSafePictureUrl` で https のみ許可・ループバック拒否)、`store/profile-store.ts`(stale-while-revalidate、`publicKey` 購読、iframe モードでは no-op)。

### 低優先度（機能拡張・検証）
- [x] フォローの投稿をタイムラインに表示する機能を実装する。
- [x] Vitestを使用したテストを実装する。（単体・統合テスト）
- [x] Utils系の関数にテストを追加
- [x] アプリケーション情報にcommit hashを追加
- [x] ビットワーデンの対応可否を確認する。
- [x] Setting画面が肥大化しているのでセクションごとにコンポーネントに切り出す
- [x] リレーの表示は設定に移動させる
- [x] パスキー作成が必要なケースの案内を追加する。
