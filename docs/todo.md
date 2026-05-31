# Nosskey SDK TODOリスト

## Context

本リストは未完了項目を **優先度ベース (P0–P3)** で整理する。初期リリースを目指す現時点では、P0（リリースブロッカー）を順に潰し、P1（UX・整合性）まで終わらせてから 0.1.0 を切る想定。P2 以降はリリース後の v0.1.x 〜 v0.2 系で順次対応する。

iframe 機能拡充の Phase 番号は `docs/iframe-expansion-plan.md` の体系を維持し、本リストの各項目末尾に括弧書きで対応関係を残す。サンプルアプリ (`examples/svelte-app`) 固有の TODO も本リストに統合済みで、各優先度セクション内の「サンプルアプリ（svelte-app）」小見出しに整理している。

---

## P0: 初期リリース必須（Release Blockers）

リリースタグを切る前に終わらせる必要がある項目。

- [ ] **バージョニング** — `package.json` のバージョン番号（現在 0.0.0）を初期リリース用に更新。対象ワークスペース: `packages/nosskey-sdk`, `packages/nosskey-iframe`, `examples/*`。リリース順序・semver ポリシー（SDK と iframe をロックステップで上げるか独立か）を決める必要あり。**publish 方針は決定済み: `nosskey-sdk` と `nosskey-iframe` を独立 publish。理由 = client は SDK ゼロ依存で出せる / iframe protocol は SDK と別ライフサイクルで動く（詳細はアーカイブ「`nosskey-iframe` を独立 publish する前の整理」項目参照）。**
- [ ] **外部セキュリティレビュー** — レビュー範囲（SDK コア / iframe protocol・host・client / consent ロジック）と発注先の判断が必要。

## P1: リリース前に強く推奨（UX・整合性）

リリース直前で着手しても間に合う、ただし入っていると印象が大きく変わる項目。

- [ ] **nosskey-iframe と他アプリを iframe で組み合わせて1つの Nostr アプリとして構築** — nosskey-iframe を NIP-07 署名プロバイダとして埋め込みつつ、別の Nostr クライアント（タイムライン・DM 等）を同一ページに並置し、単一 Nostr アプリとして動作させる統合パターンの設計と参照実装。導入障壁を下げる効果が大きい。
- [ ] **iframe 経由フローで Android Chrome の Google Password Manager が候補に出ない** — SDK 単体（svelte-app 直叩き）では PR #93 修正で PWM が候補に上がるようになったが、iframe サンプルアプリ経由で署名（または新規登録）すると候補から外れる。**仮説**: WebAuthn `get` 呼び出しは仕様上 `authenticatorSelection`（residentKey / requireResidentKey）を受け付けず、候補制限は `allowCredentials` 経由でしか効かない。iframe child の partitioned localStorage で NostrKeyInfo が読めず credentialId が undefined → `allowCredentials = []`（全 passkey から選択モード）になると、Android Chrome の Credential Manager が PWM 同期パスキーを候補から外す挙動を引く可能性。**確認手順**: Android Chrome の DevTools で iframe child コンテキストの Application > Local Storage に `nosskey_pwk` キーが存在し credentialId が入っているか / SAA grant 後に `setStorageOptions({ storage: handle.localStorage })` が反映されているかを実機検証。**該当箇所**: `packages/nosskey-iframe/src/host.ts`、`packages/nosskey-sdk/src/prf-handler.ts:147`（allowCredentials 組立）、`packages/nosskey-sdk/src/nosskey.ts:116-131`（setStorageOptions）。**対応方針**: 実機で再現が確認できてから対応する。

## P2: 中期で取り組む（堅牢化・新機能）

リリース後の v0.1.x 〜 v0.2 系で消化する想定。

### iframe 接続堅牢化（Phase 3）
3-A〜3-D はセットで一括対応すると効率的。

- [ ] **ヘルスチェック（ping/pong）（Phase 3-A）** — 定期的な接続確認メッセージ。
- [ ] **自動再接続（Phase 3-B）** — 接続断検知後の iframe 再マウント。
- [ ] **`nosskey:error` プロアクティブ通知（Phase 3-C）** — iframe 側エラーを親へ通知。
- [ ] **長時間放置後の orphan request タイムアウト対策（Phase 3-D）** — 親タブが長時間放置されて iframe document が discard された後、最初の operation が in-flight でも受け手が居らず `NosskeyIframeClient` のデフォルト 60 秒 timeout reject になる問題。`pagehide` / `freeze` で client 側に "needs revalidate" フラグを立て次操作前に `ready()` 再確認するか、`nosskey:ready` 再受信時に client 側で「ready 再到来」を検出して in-flight request を再送する、いずれかの設計を検討。BFCache 復元自体は iframe 側の `pageshow` 再判定で鍵 rehydrate される (PR #75) ので、課題は親 SDK 側の "iframe が再ロードされたか" 検出に絞られる。実害報告があり次第対応。

### 新機能・拡張
- [ ] **parent-sample の publish で `getRelays` 取得リレーを使う** — iframe 親アプリ（`examples/parent-sample`）のイベント publish 時に、現状の手入力リレー URL（`src/main.ts` の `parseRelayUrl(ui.relayUrl.value)` → `publish(relay.value, event)`）ではなく、iframe 経由 `window.nostr.getRelays()`（`src/main.ts:159` で取得済み）で得たリレー一覧を送信先に使うようにする。複数リレーへの publish 対応や、取得失敗時の手入力フォールバックも検討する。
- [ ] **`switchKey(credentialId)` メソッド（Phase 4-A）** — iframe 経由でのキー切り替え。マルチキーユーザー向け。
- [ ] **秘密鍵 hex 文字列のメモリ残存リスクの対応可否検討** — SDK 内部で秘密鍵を `seckeySigner` 渡しや NIP-44 平文経路に通す際に hex 文字列（`string`）化される。JS の `string` は immutable で `Uint8Array.fill(0)` 相当のゼロ化 API が存在しないため、**GC タイミングまでヒープに残存**し、設計書 §11 NF5 の Uint8Array ゼロ化保証がカバーできない。影響箇所は `importNostrKey` / `exportNostrKey` / wrap モード復号後の `signEvent` / `nip44Encrypt` 平文経路など。**まず対応可否の判断から開始**: 脅威モデル上のリスク評価（ブラウザヒープに直接アクセスできる攻撃者は他経路でも危殆化済みか？） → 対応する場合は (a) `@rx-nostr/crypto` を捨てて `@noble/secp256k1` のバイト I/O へ置換、(b) `nip44Encrypt`/`nip44Decrypt` の plaintext シグネチャを `string | Uint8Array` 受けに拡張、の両方が必要。docs/{ja,en}/nosskey-sdk-interface（`importNostrKey` セキュリティメモ）・設計書 §11 (NF5) に制約として既に注記済み。

### サンプルアプリ（svelte-app）の中優先項目
- [ ] **新規パスキー作成時にパスキー認証が 2 回要求される問題の調査・修正** — 新規作成タブは `createNew()`（`AuthScreen.svelte` の `createPasskey()` = WebAuthn `create`）でパスキー作成後、成功画面で改めて「ログイン」ボタン → `login(credentialId)`（`createNostrKey()` = WebAuthn `get`/PRF）を押す 2 ステップ。既存 nsec インポート経路（`importExisting()` → `createPasskey()` → `importNostrKey()`）は `createPasskey` 時の PRF が `#pendingPrfByCredId` にキャッシュされ消費されるため UV 1 回・1 ステップで完了する。新規作成側でも create 時の標準 salt PRF を消費して 2 回目の `get` を省けるか（＝ create→createNostrKey を 1 ボタンに統合できるか）を検証する。`createPasskey` が PRF 結果を返さないブラウザがある場合はフォールバックが必要なので、ブラウザ依存の切り分けも行う。
- [ ] **テーマを 2 種類から 4 種類に増やす** — 現状 `ThemeMode = 'light' | 'dark' | 'auto'`（`app-state.ts:59`。実テーマは light/dark の 2 種、auto は OS 追従）。選択可能なカラーテーマを 4 種類に拡張する。`ThemeMode` 型・`currentTheme` ストア・`loadThemeSetting()`（`app-state.ts:131` の許容値チェック）・テーマ適用ロジック・CSS variables（テーマ別カラーセット）・`theme-settings.svelte` の UI・i18n ラベル・iframe へ渡す `?theme=` クエリパラメータ（`NosskeyIframeClient` / `buildIframeUrl` と受信側 `app-state.ts:222`）の許容値もあわせて更新が必要。
- [ ] **テストの充実** — Vitest の追加導入は完了済み (`vitest.config.ts` 等)。今後は store / service レイヤと画面遷移のカバレッジ拡充。
- [ ] **複数アカウント対応（UI 側責務）** — 複数パスキーを切り替えて使える UI と内部状態管理。SDK/iframe 側の `switchKey` API は本リストの Phase 4-A が所有。本項目は API 完成後にそれを呼び出すサンプルアプリ側の画面実装。
- [ ] **より詳細な攻撃ベクトルの検討とリスク評価** — 同意ポリシー / 信頼済みオリジン / iframe 周りの再評価。

## P3: 長期・将来（環境依存・余裕があれば）

ブラウザサポート拡大やフレームワーク統合など、需要が出てから着手すれば良い項目。

- [ ] **Safari 向け `window.open()` フォールバック（Phase 5-A）** — Safari PRF サポート安定後に対応。
- [ ] **`nosskey-elements` パッケージ追加（Phase 7-A）** — `<nosskey-button>` Web Components として提供。工数 L、需要次第。
- [ ] **`NostrKeyInfo` のリレーへのバックアップを行うイベントの作成機能**（リレーへのパブリッシュは SDK の責務外とする）— `credentialId` / `salt` 等の機密性のあるメタデータを第三者リレーに送ることになり、Nostr pubkey と特定パスキーの紐付けがリンク可能になるプライバシーリスクがある。実装する場合は暗号化形式・許容リレーの設計を慎重に検討する必要あり。
- [ ] **他の Nostr ライブラリとの統合例をドキュメントに追加** — エコシステム成熟待ち。

### サンプルアプリ（svelte-app）の低優先項目
- [ ] **秘密鍵紛失時の回復方法についての説明を追加する**
- [ ] **Windows（Edge）での動作をテストする**
- [ ] **Windows についての注意書きを追加する**
- [ ] **動画によるチュートリアル**

---

## アーカイブ（完了済み）

### ドキュメント関連
- [x] **README.md / README.ja.md の充実** — Getting Started に相当する Basic Usage Examples（パスキー作成・鍵生成・NIP-44 暗号化サンプル）と「iframe Mode (Cross-origin Signing)」セクション（最短手順 + `docs/{ja,en}/iframe-integration` への詳細リンク）を両言語版に追加済み。NIP-44/NIP-04 節は既に反映済み。`docs: sync iframe-host, README, and svelte-app docs with current code` (#61)・`docs: add bilingual iframe embedding integration guide` (#74) 等で順次反映。
- [x] SDKインターフェースドキュメント(`docs/{ja,en}/nosskey-sdk-interface`)を実装に同期 — NIP-44/NIP-04 の4メソッド(`nip44Encrypt/Decrypt`・`nip04Encrypt/Decrypt`)、ja版 `createNostrKey` のシグネチャ(`options` 引数)、コンストラクタの `prfOptions`(+`GetPrfSecretOptions` 型)を両言語版に反映。barrel が公開する標準関数(nip44 低レベル関数・PRFハンドラー関数・バイト変換・テストユーティリティ)を「パッケージエクスポート」節として追加。`crypto-utils.ts` および外部利用の無い nip04 低レベル関数の barrel export は削除済み
- [x] iframe-host ドキュメント(`docs/{ja,en}/iframe-host`)を全面更新 — 「getPublicKey/signEvent の2メソッド」前提の記述を、7メソッドのNIP-07プロバイダの実態に修正。consent対象メソッド・`getRelays`・3ボタン同意ダイアログ・`evaluateConsent`/`onConsent`/`startIframeHost` の現行サンプルコード・consentポリシー/信頼済みオリジン・`theme`/`lang`/`embedded`・Storage Access API を反映。日英を同内容で更新
- [x] `docs/iframe-expansion-plan.md` のステータス表を実態に修正 — Phase 1-B/1-C(nip44/nip04)・2-A/2-B(オリジン別許可・メソッド別ポリシー)は実装済みなのに「未実装」表記。localStorageキー名を `nosskey_trusted_origins_v2` に、ファイルパスを `src/components/screens/` に修正
- [x] `docs/iframe-plan.md` をアーカイブ扱いにする — 完了済み・`iframe-expansion-plan.md` に統合された旨のバナーを追記(古い3メッセージ/2メソッドのプロトコル記述が現行と混同される)
- [x] PRF対応表(`docs/{ja,en}/prf-support-tables`)・`prf-study` を2026年時点で再検証・日付更新 — 日英4文書を 2026-05 時点に更新。WebAuthn L3 を Working Draft→Candidate Recommendation(2026-01-13)、Firefox を「OFF(試験的)」→「135 以降デフォルトON」(対応表と prf-study の内部矛盾も解消)、Windows Hello を「未対応」→「対応(条件付き、Windows の `WEBAUTHN_API_VERSION_8` + Chrome 147/Firefox 148 等。対応開始ビルドは公式未明文化のため要実機確認)」、1Password を「β版」→正式対応、Dashlane を「未対応」→PRF採用に修正。Safari の外付けセキュリティキー PRF 非対応の制約も追記。各 prf-study に最終再検証日(2026-05-17)と出典を追加。`examples/svelte-app/README.md` の古い Windows Hello 記述も修正
- [x] `README.md` / `README.ja.md` の機能一覧・APIリファレンスに NIP-44/NIP-04 メソッドを追記 — APIリファレンスに `nip44Encrypt/Decrypt`・`nip04Encrypt/Decrypt` の4メソッド節を新設、機能一覧に「暗号化メッセージング」項目と NIP-44 使用例コードを追加。iframe パッケージ節は既に記載済み。あわせて旧 `docs/iframe-plan.md` リンクを `iframe-host` 文書に修正
- [x] `examples/svelte-app/svelte-app-design.md` を現行アーキテクチャに全面改訂 — 存在しない `Timeline`/`PostForm`/`ProfileEditor`/`timeline`画面の記述を削除し、3画面(account/key/settings)＋iframeルート・iframeホストモード・consentポリシー・現行のファイルツリー/ストア/サービス構成を記載。rx-nostr 依存削除も反映
- [x] `examples/svelte-app/README.md` から削除済み機能(「Nostrメッセージの作成と署名」「リレーへの送信」)を除去し、iframe署名プロバイダモードを含む現行機能に書き直し。Chrome対応バージョンを 118 に統一(116→118)。壊れたリンク `../../docs/prf-support-tables.md` を `../../docs/ja/prf-support-tables.ja.md` に修正。技術スタックの rx-nostr 削除も反映
- [x] ドキュメント内のリンク切れ修正 — `nosskey-specification` 内の `sdk-if.md`(存在しない/正しくは `nosskey-sdk-interface`)・`prf-support-tables.md`(実体は `*.en.md`/`*.ja.md`)
- [x] NIP draft 英語版(`docs/nip-draft.md`)のタイトルを日本語版に合わせて修正 — `Passkey-Wrapped Keys`(旧wrap方式の名残)→ `Passkey-Derived Nostr Keys`

### 実装関連
- [x] **既存鍵の活用（wrap モード）** — ユーザーが既に持っている Nostr 秘密鍵を、パスキー PRF（`WRAP_SALT` 由来 KEK）で NIP-44 v2 暗号化して `NostrKeyInfo.wrapped.payload` に保存し、PRF 由来鍵と同じ UX（`signEvent` / `nip44` / `nip04` 等）で使えるようにする機能。SDK に `importNostrKey(seckey, credentialId, options)` / `exportNostrKey()` を追加し、`createPasskey` 時に標準 salt と wrap salt の PRF を 1 回の UV で同時取得 → `#pendingPrfByCredId` にキャッシュして直後の import で消費（PR #92）。サンプルアプリの `AuthScreen` 「インポート」タブが `createPasskey` → `importNostrKey` → `loginWith` で nsec インポート（入力欄即時クリア・seckey ゼロ化の二重防御つき）。秘密鍵 hex 文字列のメモリ残存リスクのみ別項目として P2 に残置。
- [x] salt値の不整合を解消 — 実際のPRF入力 `'nostr-pwk'`(hex `6e6f7374722d70776b`) を正とし、`STANDARD_SALT`(`nosskey.ts`)・`types.ts` の JSDoc・`nip-draft`(和英)・インターフェース文書(和英) を統一。さらに `salt` を `getPrfSecret` の評価入力に配線し、`createNostrKey`/`signEventWithKeyInfo`/`exportNostrKey`/`nip44`/`nip04` で `keyInfo.salt` が実際に使われるようにした。旧誤値 `6e6f7374722d6b6579` で保存された既存 `NostrKeyInfo` は導出時・ストレージ読込時に標準値へ正規化して保護（`prf-handler.ts` の `'nostr-pwk'` 自体は非変更のため鍵は壊れない）
- [x] `crypto-utils.ts`(AES-GCM の `deriveAesGcmKey`/`aesGcmEncrypt`/`aesGcmDecrypt`)を削除 — どこからも import されないデッドコードのため、ソース・テスト・barrel export を削除。`nosskey-specification` の「暗号化/復号アプローチ（代替手法）」は設計上の代替案の記述であり API 実装の主張ではないため変更不要
- [x] NIP-17 sealed DM (kind:14 + gift-wrap) サポート — 動作確認用の実装は `examples/parent-sample/src/nip17.ts`(+ `nip17.spec.ts`) に **parent-sample 内ヘルパー** として存在し、セクション 7 の "Send NIP-17 DM" で他クライアントとの受信検証が可能。kind:14 rumor / kind:13 seal (Nosskey の NIP-44 encrypt + signEvent) / kind:1059 gift-wrap (ephemeral 鍵で署名) の 3 段構成を `sendNip17Dm()` として実装済み。`packages/nosskey-sdk` 本体には未エクスポート。SDK 本体への昇格は別タスク化せず、再利用ニーズが具体化したタイミングで改めて検討する。
- [x] iframeでNosskeyを使用できるNosskey-iframe(仮)の作成 — 段階1〜4完了 (`nosskey-iframe` パッケージ: protocol / host / client)。ブランチ `claude/add-iframe-support-2tKuX`
- [x] Nosskey-iframe(仮)の参照実装の作成 — 段階5〜7完了 (Svelteアプリの `#/iframe` ルート、ConsentDialog、Timeline/relay 機能削除、README 追記)。ブランチ `claude/continue-iframe-support-mCrAL`。段階8 (E2E 手動検証) は別途
- [x] iframe を埋め込む親ページ側のサンプル実装 (`NosskeyIframeClient` を使った最小デモ) を `examples/parent-sample/` に追加
- [x] parent-sample に NIP-44 / NIP-04 encrypt/decrypt UI と NIP-04 kind:4 DM 送信ボタンを追加 (任意ピア宛 DM 動作確認用)
- [x] **`nosskey-iframe` を独立 publish する前の整理** — PR #80 で対応。`packages/nosskey-iframe/package.json` の `dependencies.nosskey-sdk: "*"` を `peerDependencies` (`^0.1.0`、`optional: true`) に降格し、`nosskey-sdk` を `devDependencies` に残してビルド時依存を維持。`README.md` / `README.ja.md` を "Client only (the common case)" / "Host (you operate the signing iframe)" の2セクション構成に書き直し、Install・Quick start を節ごとに分離。

### iframe Phase 1: NIP-07 完全対応
- [x] `getRelays()` の追加 — リレー設定の取得 (iframe `onGetRelays` コールバック + Svelte UI、SDK 非変更方針)
- [x] `nip44.encrypt / decrypt` の追加 — NIP-44 v2 を SDK (`packages/nosskey-sdk/src/nip44.ts`)、iframe protocol/host/client、ConsentDialog で実装。公式テストベクター (`__fixtures__/nip44-vectors.json`) 全件パス。ブランチ `claude/review-todos-nFRqm`
- [x] `nip04.encrypt / decrypt` の追加 — NIP-04（レガシー DM、AES-256-CBC）を SDK (`packages/nosskey-sdk/src/nip04.ts`)、iframe、ConsentDialog で実装。ラウンドトリップテスト追加。ブランチ `claude/review-todos-nFRqm`

### iframe Phase 2: UX・セキュリティ改善
- [x] オリジン別の許可記憶 — 「このサイトを常に許可」で origin×method を `localStorage` (`nosskey_trusted_origins_v2`、設計書の `nosskey_trusted_origins` から v1 ユーザー無し前提で破壊的置換) に保存。`examples/svelte-app/src/store/app-state.ts` (`TrustedOriginEntry` / 永続化) + `examples/svelte-app/src/utils/consent-gating.ts` (`evaluateConsent`) + `ConsentDialog.svelte`
- [x] メソッド別の同意ポリシー設定 — `signEvent` / `nip44` / `nip04` ごとに「毎回確認 / 常に許可 / 拒否」を保持。`ConsentPolicy` 型 + `policyKeyFor()`（nip44/nip04 encrypt/decrypt は同バケット集約） + `localStorage` (`nosskey_consent_policy`)。評価順は deny > always > trusted-origin > ask

### iframe Phase 6: ダイアログ UX 改善
- [x] ダイアログ表示内容の整理 — `kindLabel()` で kind ラベル化、content は 100 文字プレビュー、`<details>` で raw event JSON を折りたたみ表示、nip44/nip04 では `renderPeerPubkey()` で相手 pubkey を短縮表示（`examples/svelte-app/src/components/ConsentDialog.svelte`）
- [x] スタイル整理 — `--color-card` / `--color-text` 等の CSS variables 化と `@media (max-width: 480px)` レスポンシブ対応（`ConsentDialog.svelte`）
- [x] テーマ・言語を親から渡す — URL クエリパラメータ (`?theme=dark&lang=en`) 経由。`NosskeyIframeClient` に `theme` / `lang` オプションを追加し `buildIframeUrl()` で URL に自動付与、Svelte アプリ側の受信 (`app-state.ts` / `i18n-store.ts`) も対応済み。PR #52
- [x] 設定ページへのリンク遷移 — NO_KEY エラー時のセットアップ誘導 — `IframeHostScreen` の鍵が使えない4状態(`noKeyExists`/`unsupported` は主ボタン、`partitioned`/`denied` は副リンク)に、別タブで account 画面(`#/account`、パスキー登録・ログイン)を開く「セットアップを開く」導線を追加。あわせて `ConsentDialog` の許可ダイアログにも settings 画面(`#/settings`、信頼済みサイト・同意ポリシー)を開く「同意設定を開く」小リンクを追加。URL 組み立ては純粋関数 `buildScreenUrl`(`utils/app-navigation.ts`)に切り出し単体テスト追加。doc 6-D の protocol メッセージ(`nosskey:setup_required`)追加は「任意」のため見送り
- [x] **サンプルアプリの登録ログイン画面のデザイン UX 改善** — `examples/svelte-app/src/components/screens/AuthScreen.svelte` を中心に PR #83/#84/#85/#86/#88 で連続改善。PR #83 で login/register をタブ分割し help tooltip (`HelpTip`) を追加、PR #84 でモバイル横スクロール抑止、PR #85 で auth カードのタイトル行に tooltip 位置を揃え、PR #86 で flex column 親で auth-container を伸張、PR #88 で過去ログイン履歴に応じてデフォルトタブを切替。

### テスト関連
- [x] テストの完全性確認：すべての機能とエッジケースのカバレッジ — 全4ワークスペースの未テスト公開関数・エッジケースを補完。nosskey-sdk: `bytesToBase64`/`base64ToBytes` の単体テスト、`secp-utils.ts`(`liftEvenXOnly`/`ecdhSharedX`)の新規テストファイル、NIP-44 平文長境界(1/65535バイト)・改竄ペイロード(version/MAC)テストを追加。nosskey-iframe: `isEncryptMethod`/`isDecryptMethod`・`iframe` getter のテストを追加。`examples/svelte-app` は vitest 設定が無く既存4 spec が未実行だったため `vitest.config.ts`・`test`/`test:coverage` スクリプト・依存(vitest/happy-dom/coverage-v8)を追加して有効化し、`event-kind-labels.ts` のテストも新規追加
- [x] エラー処理のテスト強化 — 例外・拒否パスを重点補完。nosskey-sdk: ストレージ書き込み失敗(`#saveKeyInfoToStorage` の `setItem` 例外)、NIP-44 nonce override 長さ検証、NIP-04 不正IV長・非ブロック整列 ciphertext、secp256k1 の鍵長・公開鍵検証。nosskey-iframe client: 結果型不一致・Window/Document/コンテナ欠落・`crypto.randomUUID` 不在フォールバック・ready前 destroy・destroy後リクエスト。host: Window 欠落・`event.source` null・decrypt 系の NO_KEY/INVALID_REQUEST・非Error 例外の INTERNAL 化と visibility 復帰。あわせて `#saveKeyInfoToStorage` が書き込み失敗時に unhandled rejection を起こす不具合を read 側と同じ catch+log パターンで修正

### その他
- [x] `NosskeyDerivedKey`インターフェースの`rawSignature`プロパティが実装から削除されているかを確認（意図的か漏れか）
- [x] セキュリティレビュー：キー導出ロジックと乱数生成部分の詳細な確認

### サンプルアプリ（svelte-app）

#### P2（中期）
- [x] **「鍵情報をエクスポート」が動作しないバグの修正** — `ExportKeyInfoComponent.svelte:44` で `JSON.stringify(exportKeyInfo, ...)` と **関数 `exportKeyInfo` 自身**を直列化していたのを、32 行目で取得済みの `currentKeyInfo`（`NostrKeyInfo`）を直列化するよう修正。直列化ロジックを純粋関数 `utils/key-info-export.ts`（`serializeKeyInfoForExport`）へ切り出し、`isNostrKeyInfo` との往復検証 spec を追加して回帰防止。インポート側（`ImportKeyInfo.svelte`）は `JSON.parse` → `isNostrKeyInfo` 検証 → `loginWith` 経路のため往復成立。

#### P1（リリース前推奨）
- [x] **ログアウト後の wrap モード鍵で再ログインできるようにする** — PR #94 で対応。ログアウトを「current ポインタ（`nosskey_pwk`）＋派生キャッシュのみ消去」に変更し、別キー `nosskey_accounts` のアプリ内マルチアカウント登録簿（`store/accounts.ts`: upsert/remove/list ＋ salt 正規化 ＋ 既存 current 鍵の一度きり移行）は保持するようにした。これにより wrap モード鍵（暗号化 nsec が localStorage にしか無い）も失われず再ログイン可能。`logout()` 後は `hasKeyInfo()` が false になり無言の自動ログインを防止。`loginWith()`（新規作成 / nsec インポート / KeyInfo ファイルインポート / 保存済みアカウント再ログインの共通活性化経路）で復元。`SavedAccounts.svelte` がログインタブ上部に保存済みアカウント一覧（再ログイン＋5秒キャンセル可能な削除）を表示。影響ファイル: `store/accounts.ts`（新規）・`store/app-state.ts`・`components/SavedAccounts.svelte`（新規）・`components/screens/AuthScreen.svelte`・`components/settings/ImportKeyInfo.svelte`。`accounts.spec.ts` 追加。

#### P3（長期・将来）
- [x] **新規登録タブのラベルを簡潔にする** — `methodNew`「パスキーを新規作成」→「新規作成」、`methodImport`「既存nsecをインポート（ベータ版）」→「インポート（ベータ版）」に短縮（ja/en）。
- [x] **削除ボタンをゴミ箱アイコンに統一する** — 設定のリレー削除（`RelaySettings.svelte`）・信頼済みオリジン削除（`TrustedOriginsSettings.svelte` の origin 全削除／メソッド別削除）のテキストボタンを、`SavedAccounts.svelte` と同じ `IconButton` + `delete-icon.svg` に統一。

#### 最高優先度（SDK関連・クリティカルな問題）
- [x] シークレットキーのキャッシュ問題を修正する。（TTL期間内でも毎回認証が必要になっている問題）
- [x] SDK起因のバグを修正する。（キャッシュなど）
- [x] SDKのインターフェースを再検討する。（pwkとprf directの統一性、公開鍵の保持など）
- [x] PWKManagerをシングルトンにする（キャッシュ設定に一貫性を持たせるため）
- [x] 秘密鍵インポート機能の動作を確認する。
- [x] デフォルトのリレーが初期設定されていない問題を修正する。
- [x] SDKにPWK保存機能をつける(optionに追加してデフォルト有効にする。NIP-07に合わせてsignEvent, getPublicKeyメソッドを追加。拡張性のためgetCurrentPWKメソッドも追加。PWKを使っているメソッドにPWKなしでも使えるようにしておくPWKがなかったらエラー)

#### 高優先度（重要なUX改善とセキュリティ）
- [x] インポート→戻るを押すとホワイトアウトする問題を修正する。
- [x] `authenticated`変数を`isLoggedIn`など意味がより明確な変数名に変更する。
- [x] `nosskey_credential_ids`の保管と表示をやめる。
- [x] 認証関係（登録、ログイン）のユースケースと動線をわかりやすく改善する。
- [x] 既存のパスキーで作成済みPRFダイレクトアカウントにPWKなしでログインする動線を追加する。
- [x] 認証画面の情報の整理
- [x] 認証画面のカードデザインへの統一

#### 中優先度（基本機能強化）
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

#### 低優先度（機能拡張・検証）
- [x] フォローの投稿をタイムラインに表示する機能を実装する。
- [x] Vitestを使用したテストを実装する。（単体・統合テスト）
- [x] Utils系の関数にテストを追加
- [x] アプリケーション情報にcommit hashを追加
- [x] ビットワーデンの対応可否を確認する。
- [x] Setting画面が肥大化しているのでセクションごとにコンポーネントに切り出す
- [x] リレーの表示は設定に移動させる
- [x] パスキー作成が必要なケースの案内を追加する。
