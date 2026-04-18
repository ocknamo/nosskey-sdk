# Nosskey SDK TODOリスト

## ドキュメント関連
- [ ] README.mdの充実：使用方法やサンプルコードの追加
- [ ] 他のNostrライブラリとの統合例をドキュメントに追加

## 実装関連
- [ ] PWKのリレーへのバックアップを行うイベントの作成機能（リレーへのパブリッシュはSDKの責務外とする）
- [x] iframeでNosskeyを使用できるNosskey-iframe(仮)の作成 — 段階1〜4完了 (`nosskey-iframe` パッケージ: protocol / host / client)。ブランチ `claude/add-iframe-support-2tKuX`
- [x] Nosskey-iframe(仮)の参照実装の作成 — 段階5〜7完了 (Svelteアプリの `#/iframe` ルート、ConsentDialog、Timeline/relay 機能削除、README 追記)。ブランチ `claude/continue-iframe-support-mCrAL`。段階8 (E2E 手動検証) は別途

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