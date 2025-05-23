# Nosskey SDK TODOリスト

## ドキュメント関連
- [x] `NosskeyDerivedKey`インターフェースの`rawSignature`プロパティが実装から削除されているかを確認（意図的か漏れか）
- [ ] README.mdの充実：使用方法やサンプルコードの追加
- [ ] 他のNostrライブラリとの統合例をドキュメントに追加

## 実装関連
- [x] `deriveKeyFromSignature`メソッドの公開/非公開の方針確認（ドキュメントでは公開メソッド、実装ではprivate）
- [x] APIの一貫性確保：インターフェースと実装間（特に`registerPasskey`の引数）
- [x] サンプルアプリケーションの作成：実際の使用例を示すデモアプリ

## テスト関連
- [ ] テストの完全性確認：すべての機能とエッジケースのカバレッジ
- [ ] エラー処理のテスト強化

## 品質とセキュリティ
- [x] セキュリティレビュー：キー導出ロジックと乱数生成部分の詳細な確認

## リリース準備
- [ ] バージョニング：package.jsonのバージョン番号（現在0.0.0）を初期リリース用に更新 