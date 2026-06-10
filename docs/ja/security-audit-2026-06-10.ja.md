# セキュリティ診断報告（2026-06-10）

**対象**: `packages/nosskey-sdk` / `packages/nosskey-iframe` / `examples/svelte-app` / `examples/parent-sample` / CI・依存関係

**脅威モデル**:

1. シークレット（nsec / PRF 出力 / 暗号化済み鍵）の漏出
2. ユーザの意図しない操作（同意なし署名・送信、postMessage 悪用）
3. アカウントの喪失・乗っ取り

> 注: 本文書内の行番号は診断対象コミット `adcb788` 時点のものであり、その後の変更でずれる可能性がある。

## 総評

アーキテクチャレベルの致命的欠陥はない。平文の nsec は永続化されず（直接モードは credentialId+pubkey のみ、wrap モードは NIP-44 暗号化）、export 時の UV 強制（`nosskey.ts:688`）、wrap 復号後の pubkey 整合性検証（`nosskey.ts:811`）、iframe クライアント側の source+origin 二重検証（`client.ts:322-327`）、徹底した try/finally でのメモリゼロ化など、丁寧な防御が随所にある。npm audit は 0 件、週次 audit CI も設定済み。

一方で、iframe は「任意の Nostr クライアントから埋め込める汎用署名プロバイダ」というオープン埋め込みモデルを設計意図とするため、オリジン許可リストによる閉鎖は解にならない。そのモデルを前提とすると、**同意ゲートを通らない `getPublicKey` / `getRelays` が任意サイトに開放されている点が最大の問題**である。

---

## 🔴 High

### H-1. `getPublicKey` / `getRelays` が同意なしで全オリジンに開放されている

- **箇所**: `packages/nosskey-iframe/src/host.ts:181-190`（実装）、`packages/nosskey-iframe/src/protocol.ts:22`（`CONSENT_REQUIRED_METHODS` に両メソッドが含まれない）
- **脅威**: ②意図しない操作、①シークレット漏出（プライバシー）
- **前提**: Nosskey の iframe は「任意の Nostr クライアントから埋め込める汎用署名プロバイダ」として提供する設計意図がある（クロスプラットフォーム利用）。したがってオリジン許可リストによる閉鎖は製品意図と衝突し、解にならない。本指摘はオープン埋め込みモデルを前提に残存リスクを評価したもの。
- **内容**: `getPublicKey` / `getRelays` は同意ダイアログの対象外のため、**任意の悪意あるサイトが不可視 iframe を埋め込むだけで、ログイン中ユーザーの npub とリレー設定をサイレントに取得**できる。閲覧者の Nostr アカウント特定（デアノニマイズ・トラッキング）がウェブ全体でノーインタラクションで成立する。署名・暗号化・復号は同意ダイアログで守られるが、任意オリジンがダイアログを出し放題のため、同意疲れや紛らわしい文面による誤承認（さらに「常に許可」チェック → 恒久化）も誘発できる。
- **推奨**: 同じ「どのサイトからでも使える」モデルの NIP-07 ブラウザ拡張（nos2x / Alby 等）が採用している方式に揃える。すなわち `getPublicKey` に**オリジン単位の初回接続承認**（ペアリング）を導入し、承認済みオリジンを既存の trusted origins 機構で記憶する。これによりクロスプラットフォームの利用性を損なわずにサイレント取得だけを塞げる。

---

## 🟡 Middle

### M-1. decrypt 系メソッドへの「常に許可」が DM 復号オラクルになる

- **箇所**: `examples/svelte-app/src/iframe-mode.ts:29-43`（trustOrigin 永続化）、`packages/nosskey-iframe/src/host.ts:208-226`、`ConsentDialog` 経由
- **脅威**: ①シークレット漏出
- **内容**: `nip44_decrypt`/`nip04_decrypt` の同意ダイアログには相手 pubkey しか表示されず（設計上、復号前に中身を出せないのは妥当）、ユーザーは何を復号するのか判断できない。一度「このサイトを常に許可」を付けると、その origin は**以後無確認で任意の暗号文を復号し放題**になる。信頼済みサイトに XSS が一つあれば、ユーザーの全 DM 履歴を静かに平文化して持ち出せる。オープン埋め込みモデル（任意サイトが iframe を埋め込める前提）では、悪意あるサイトが「常に許可」へ誘導する入口も無制限にあるため深刻度が増す。
- **推奨**: decrypt 系だけは「常に許可」を選べなくする、またはレート制限・直近復号ログの可視化を入れる。

### M-2. wrap モードの暗号化 nsec は localStorage が唯一のコピー（アカウント喪失）

- **箇所**: `packages/nosskey-sdk/src/key-registry.ts`（設計）、`types.ts:33-38`
- **脅威**: ③アカウント喪失
- **内容**: インポートした既存 nsec の暗号文（`wrapped.payload`）は localStorage（＋Safari 向け cookie ミラー）にしか存在しない。ブラウザのサイトデータ消去・プロファイル削除・cookie の 1 年期限切れで**復元不能**になる。`backupKeyInfo()` とアプリのエクスポート UI は存在するが、バックアップは任意操作。また直接モードはパスキー本体の削除＝鍵の喪失（クラウド同期頼み）。これは設計上のトレードオフとしてドキュメント化されているが、wrap モードのインポート完了時にバックアップを強く促す（または強制する）導線がないのはギャップ。
- **推奨**: wrap モードの鍵作成直後にバックアップファイルのダウンロードを必須ステップにする。

### M-3. CSP 未設定 × 秘密鍵キャッシュがデフォルト有効（5分）

- **箇所**: `examples/svelte-app/index.html`（CSP なし）、`store/secret-cache-settings.ts`（アプリデフォルト: キャッシュ有効・TTL 300 秒）、`packages/nosskey-sdk/src/key-cache.ts`
- **脅威**: ①シークレット漏出
- **内容**: ホストアプリに CSP がなく、XSS への多層防御がない。万一 XSS が成立した場合、UV なしでは PRF（鍵素材）は取れないものの、**キャッシュ有効期間中は平文鍵がメモリにあり、`signEvent`/`nip44Decrypt` を UV なしで叩ける**。さらに trusted origins / consent policy / cache TTL がすべて localStorage にあり改ざん可能（TTL は NaN/Infinity こそデフォルト値に倒されるが、負値・巨大値のクランプはない: `store/app-state.ts:114-129`）。
- **推奨**: デプロイ先（Cloudflare Pages 等）で `Content-Security-Policy` を配信。TTL に上下限（例: 0〜3600 秒）を設ける。

### M-4. iframe ホストにレートリミット・リクエスト元の固定がない

- **箇所**: `packages/nosskey-iframe/src/host.ts:143-175`
- **脅威**: ②意図しない操作
- **内容**: 任意の親（オープン埋め込みモデルでは全サイト。H-1 の接続承認を導入した後も、承認済みオリジン）は、同意ダイアログを無制限に連打できる。`event.source` への応答は正しく `targetOrigin: event.origin` 指定されており応答漏洩はないが、ダイアログ連打による誤承認誘導（consent fatigue attack）への構造的な歯止めがない。deny カウンタ（`iframe-mode.ts:58-67`）は良い観測手段だが ask 経路には効かない。
- **推奨**: 同一 origin からの未承認リクエストの頻度制限、連続拒否後の一時ブロック。

### M-5. SDK の `allowedOrigins` デフォルトが `'*'`（統合者向け footgun）

- **箇所**: `packages/nosskey-iframe/src/host.ts:43,76`（デフォルト値 `'*'`）、`examples/svelte-app/src/iframe-mode.ts:119`（本番アプリも `'*'` を明示）
- **脅威**: ②意図しない操作
- **内容**: nosskey.app 本体はオープン埋め込みが設計意図のため `'*'` 自体は妥当（H-1 の同意ゲートで守る）。一方、`nosskey-iframe` パッケージを**自分のドメインでセルフホストする統合者**にとっては、親オリジンが固定できるケースが多いにもかかわらずデフォルトが全許可であり、secure-by-default に反する。起動時の `console.warn` はあるが見落とされやすい。
- **推奨**: デフォルトを「未指定なら throw」に変更し、オープン運用したいホスト（nosskey.app 自身を含む）には明示的に `allowedOrigins: '*'` を書かせる。オープンモデルを維持したまま、意図の表明だけを強制できる。

---

## 🟢 Low

| #    | 箇所 | 内容 |
| ---- | ---- | ---- |
| L-1  | `nosskey.ts:71` | `#pendingPrfByCredId` に TTL がない。`createPasskey()` 後に `createNostrKey()` が呼ばれないエラー経路では、PRF（＝将来の秘密鍵そのもの）がページ生存中ずっとメモリに残る。 |
| L-2  | `nosskey.ts:829-840` | キャッシュ保存後の元バッファゼロ化が wrap モードのみ。直接モードでは PRF バッファが GC 任せ（コピーがキャッシュに入るため二重に残留）。 |
| L-3  | `utils.ts:54-77` | `hexToBytes` が非 hex 文字を黙ってスキップし、奇数長も切り詰める。pubkey 経路は `secp-utils.ts:24` で厳格検証済みだが、credentialId / salt 経路は無検証で、改ざんされた localStorage 値が短いバッファに化ける（wrap モードは pubkey 検証で検知、直接モードは別鍵導出になるだけ）。 |
| L-4  | `nosskey.ts:549` | PRF 出力を秘密鍵にする際、all-zero チェックのみで曲線位数 n 以上の検証なし。確率 ~2⁻¹²⁸ で後段の noble も検証するため実質理論上の指摘。 |
| L-5  | `nosskey.ts:680-694` | `exportNostrKey` が hex string を返すため呼び出し後のゼロ化が不可能（JS の制約としてコメント済み。既知の限界）。 |
| L-6  | `parent-sample/src/ui.ts:115-126` | モーダル表示リスナーが postMessage の origin / source を未検証。第三者 iframe が `nosskey:visibility` を送るとモーダルの表示/非表示を操作できる（サンプルアプリ・実害は UI 撹乱まで）。 |
| L-7  | `host.ts:127,302` / `IframeHostScreen.svelte:34` | `nosskey:ready` / `visibility` を `targetOrigin: '*'` で送信。内容は boolean のみで実害小だが、Nosskey 利用の事実が任意の親に漏れる。 |
| L-8  | `client.ts:326` | `if (event.origin && ...)` が空 origin を素通し。直前の `event.source` 検証があるため実害はほぼないが、条件は不要に緩い。 |
| L-9  | `ConsentPolicySettings.svelte:67` | `{@html}` 使用 1 箇所。現状の挿入値は数値のみで安全だが、i18n 文字列が信頼境界に入る構造。slot 化を推奨。 |
| L-10 | `ExportSecretKey.svelte:50` | エクスポート失敗時に error オブジェクトを `console.error`。鍵そのものは含まれないため低リスクだが、汎用メッセージ化が望ましい。 |
| L-11 | `.github/workflows/*.yml` | Actions がタグ参照（`@v4` 等）で SHA ピン留めなし。サプライチェーン強化として SHA 固定を推奨。 |
| L-12 | `nip04.ts` | NIP-04（AES-CBC 認証なし）のサポート自体が padding oracle 等の既知の弱さを持つが、レガシー互換目的と明記され新規利用を明確に非推奨化済み。現状の扱いで妥当。 |

## 確認済み・問題なしの主要項目

- NIP-44 v2 実装（constant-time MAC 比較・テストベクタ準拠・会話鍵の非公開化）
- Cookie 属性（`Secure; SameSite=None`、秘密情報は不含）
- 同意判定の優先順位（deny > always > trusted > ask）
- 登録簿の型ガード（`isNostrKeyInfo`）による改ざん耐性
- プロフィール取得時の schnorr 署名検証
- 依存関係（noble 系最新、`npm audit` 脆弱性 0 件、週次 audit CI）

## 優先対応の提案

1. **H-1**: `getPublicKey` へのオリジン単位の初回接続承認（NIP-07 拡張同等のペアリング）導入 — 最優先。クロスプラットフォームの設計意図を維持したままサイレントな npub 取得を塞ぐ
2. **M-1/M-4**: decrypt 系の「常に許可」抑制とレート制限
3. **M-2**: wrap モードインポート時のバックアップ必須化
4. **M-3**: デプロイ環境への CSP 追加と TTL バリデーション
5. **M-5**: SDK の `allowedOrigins` デフォルト廃止（未指定 throw・`'*'` は明示オプトイン）
