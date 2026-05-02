# Nosskey SDK TODOリスト

## ドキュメント関連
- [ ] README.mdの充実：使用方法やサンプルコードの追加
- [ ] 他のNostrライブラリとの統合例をドキュメントに追加

## 実装関連
- [ ] PWKのリレーへのバックアップを行うイベントの作成機能（リレーへのパブリッシュはSDKの責務外とする）
- [ ] NIP-17 sealed DM (kind:14 + gift-wrap) サポート — 受け取った NIP-44 暗号文を kind:13 seal でラップし、ephemeral 鍵で kind:1059 gift-wrap 化する 3 段構成。SDK に「ランダム ephemeral 秘密鍵で署名する API」を追加する必要があり、現状の `signEvent`（登録済み鍵専用）とは別経路。NIP-04 (kind:4) 互換 DM 送信は `examples/parent-sample` のセクション 6 で動作確認可能なので、それで足りる用途は当面そちらを使う想定。
- [x] iframeでNosskeyを使用できるNosskey-iframe(仮)の作成 — 段階1〜4完了 (`nosskey-iframe` パッケージ: protocol / host / client)。ブランチ `claude/add-iframe-support-2tKuX`
- [x] Nosskey-iframe(仮)の参照実装の作成 — 段階5〜7完了 (Svelteアプリの `#/iframe` ルート、ConsentDialog、Timeline/relay 機能削除、README 追記)。ブランチ `claude/continue-iframe-support-mCrAL`。段階8 (E2E 手動検証) は別途
- [x] iframe を埋め込む親ページ側のサンプル実装 (`NosskeyIframeClient` を使った最小デモ) を `examples/parent-sample/` に追加
- [x] parent-sample に NIP-44 / NIP-04 encrypt/decrypt UI と NIP-04 kind:4 DM 送信ボタンを追加 (任意ピア宛 DM 動作確認用)

### iframe機能拡充（詳細: `docs/iframe-expansion-plan.md`）

#### Phase 1: NIP-07 完全対応
- [x] `getRelays()` の追加 — リレー設定の取得 (iframe `onGetRelays` コールバック + Svelte UI、SDK 非変更方針)
- [x] `nip44.encrypt / decrypt` の追加 — NIP-44 v2 を SDK (`packages/nosskey-sdk/src/nip44.ts`)、iframe protocol/host/client、ConsentDialog で実装。公式テストベクター (`__fixtures__/nip44-vectors.json`) 全件パス。ブランチ `claude/review-todos-nFRqm`
- [x] `nip04.encrypt / decrypt` の追加 — NIP-04（レガシー DM、AES-256-CBC）を SDK (`packages/nosskey-sdk/src/nip04.ts`)、iframe、ConsentDialog で実装。ラウンドトリップテスト追加。ブランチ `claude/review-todos-nFRqm`

#### Phase 2: UX・セキュリティ改善
- [ ] オリジン別の許可記憶 — 「このサイトを常に許可」チェックボックスと localStorage 保存
- [ ] メソッド別の同意ポリシー設定 — signEvent / nip44 / nip04 ごとに「毎回確認 / 常に許可 / 拒否」

#### Phase 3: 接続堅牢化
- [ ] ヘルスチェック（ping/pong） — 定期的な接続確認メッセージ
- [ ] 自動再接続 — 接続断検知後の iframe 再マウント
- [ ] `nosskey:error` プロアクティブ通知 — iframe 側エラーを親へ通知

#### Phase 4: マルチキー対応
- [ ] `switchKey(credentialId)` メソッド — iframe 経由でのキー切り替え

#### Phase 5: ブラウザ対応拡大（将来）
- [ ] Safari 向け `window.open()` フォールバック — Safari PRF サポート安定後に対応

#### Phase 6: ダイアログ UX 改善
- [ ] ダイアログ表示内容の整理 — kind ラベル化・content プレビュー・詳細折りたたみ
- [ ] スタイル整理 — CSS variables 化・レスポンシブ対応
- [ ] テーマ・言語を親から渡す — URL クエリパラメータ (`?theme=dark&lang=en`) 経由
- [ ] 設定ページへのリンク遷移 — NO_KEY エラー時のセットアップ誘導

#### Phase 7: フレームワーク導入しやすさの改善（低優先）
- [ ] `nosskey-elements` パッケージ追加 — `<nosskey-button>` Web Components として提供

## テスト関連
- [ ] テストの完全性確認：すべての機能とエッジケースのカバレッジ
- [ ] エラー処理のテスト強化

## 品質とセキュリティ
- [ ] 外部セキュリティレビュー

## リリース準備
- [ ] バージョニング：package.jsonのバージョン番号（現在0.0.0）を初期リリース用に更新 


## アーカイブ
- [x] `NosskeyDerivedKey`インターフェースの`rawSignature`プロパティが実装から削除されているかを確認（意図的か漏れか）
- [x] セキュリティレビュー：キー導出ロジックと乱数生成部分の詳細な確認