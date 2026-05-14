# Nosskey SDK TODOリスト

## ドキュメント関連
- [ ] README.mdの充実：使用方法やサンプルコードの追加
- [ ] 他のNostrライブラリとの統合例をドキュメントに追加

## 実装関連
- [ ] PWKのリレーへのバックアップを行うイベントの作成機能（リレーへのパブリッシュはSDKの責務外とする）
- [ ] NIP-17 sealed DM (kind:14 + gift-wrap) サポート — 受け取った NIP-44 暗号文を kind:13 seal でラップし、ephemeral 鍵で kind:1059 gift-wrap 化する 3 段構成。SDK に「ランダム ephemeral 秘密鍵で署名する API」を追加する必要があり、現状の `signEvent`（登録済み鍵専用）とは別経路。**動作確認用の実装は `examples/parent-sample/src/nip17.ts` にあり、セクション 7 の "Send NIP-17 DM" で他クライアントとの受信検証が可能** (ブランチ `claude/nip44-iframe-sample-KnGuu`)。SDK 本体への昇格は再利用ニーズが出てから検討する。
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
- [x] オリジン別の許可記憶 — 「このサイトを常に許可」で origin×method を `localStorage` (`nosskey_trusted_origins_v2`、設計書の `nosskey_trusted_origins` から v1 ユーザー無し前提で破壊的置換) に保存。`examples/svelte-app/src/store/app-state.ts` (`TrustedOriginEntry` / 永続化) + `examples/svelte-app/src/utils/consent-gating.ts` (`evaluateConsent`) + `ConsentDialog.svelte`
- [x] メソッド別の同意ポリシー設定 — `signEvent` / `nip44` / `nip04` ごとに「毎回確認 / 常に許可 / 拒否」を保持。`ConsentPolicy` 型 + `policyKeyFor()`（nip44/nip04 encrypt/decrypt は同バケット集約） + `localStorage` (`nosskey_consent_policy`)。評価順は deny > always > trusted-origin > ask

#### Phase 3: 接続堅牢化
- [ ] ヘルスチェック（ping/pong） — 定期的な接続確認メッセージ
- [ ] 自動再接続 — 接続断検知後の iframe 再マウント
- [ ] `nosskey:error` プロアクティブ通知 — iframe 側エラーを親へ通知

#### Phase 4: マルチキー対応
- [ ] `switchKey(credentialId)` メソッド — iframe 経由でのキー切り替え

#### Phase 5: ブラウザ対応拡大（将来）
- [ ] Safari 向け `window.open()` フォールバック — Safari PRF サポート安定後に対応

#### Phase 6: ダイアログ UX 改善
- [x] ダイアログ表示内容の整理 — `kindLabel()` で kind ラベル化、content は 100 文字プレビュー、`<details>` で raw event JSON を折りたたみ表示、nip44/nip04 では `renderPeerPubkey()` で相手 pubkey を短縮表示（`examples/svelte-app/src/components/ConsentDialog.svelte`）
- [x] スタイル整理 — `--color-card` / `--color-text` 等の CSS variables 化と `@media (max-width: 480px)` レスポンシブ対応（`ConsentDialog.svelte`）
- [ ] テーマ・言語を親から渡す — URL クエリパラメータ (`?theme=dark&lang=en`) 経由。Svelte アプリ側の受信 (`app-state.ts` / `i18n-store.ts`) は実装済み。`NosskeyIframeClient` 側の `theme` / `lang` オプション追加・URL 自動付与が未実装
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