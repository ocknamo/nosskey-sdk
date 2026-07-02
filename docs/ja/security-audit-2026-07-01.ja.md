# セキュリティ診断報告（2026-07-01）

**対象**: `packages/nosskey-sdk` / `packages/nosskey-iframe` / `examples/svelte-app` / `examples/parent-sample` / CSP・依存関係

**攻撃モデル（ユーザー指定）**:

1. **秘密情報の漏洩** — nsec / PRF 出力（＝将来の秘密鍵）/ KEK / 暗号化済み鍵 / 会話鍵
2. **ユーザーの意図しない操作の誘発** — 同意なし署名・暗号化・復号、postMessage 悪用、同意疲れ・誤承認
3. **なりすましによるログイン** — 他人の鍵での署名・identity 表示のすり替え・iframe を悪用した identity 詐称

> 本文書の行番号は診断時点（`claude/security-audit-r1gevl` ブランチ、`main` 相当）のもの。

---

## 総評

**アーキテクチャレベルの致命的欠陥は無い。** 2026-06-10 の前回診断で挙がった 🔴 High（H-1）と 🟡 Middle の主要項目（M-1 / M-3 / M-4 / M-5）は**すべて実装・マージ済み**であることをコード上で確認した。今回、3 つの攻撃モデルそれぞれについて「なぜ成立しないか」を経路単位で追跡し、防御が期待どおり機能していることを検証した。`npm audit` は本番・全体ともに**脆弱性 0 件**。

新規に発見した**要対応（🔴/🟡）レベルの問題は無い**。残存するのは前回から継続の設計トレードオフ（M-2: wrap 鍵バックアップ強制化）と、実害の限定的な軽微指摘（Low）のみ。今回は依存を `npm ci` で実際にインストールし、`@rx-nostr/crypto` の署名器（`seckeySigner`）挙動を**ソース精読＋実行で実測**した結果、なりすまし耐性の「根拠」を差し替えた（③参照。結論は不変、L-13 として多層防御の指摘を新設）。

**検証コマンド実行結果（本診断時）**: `npm run format:check` ✅ / `npm run build` ✅ / `npm run test:coverage` ✅（nosskey-sdk 384・nosskey-iframe 149・svelte-app 213 の計 746 テスト全合格）/ `npm run check -w svelte-app` ✅（0 errors, 0 warnings）/ `npm ci` の `npm audit` ✅（脆弱性 0 件）。

以下、攻撃モデル別に「なぜ問題ないか」を根拠付きで示し、末尾に残存リスクをまとめる。

---

## 攻撃モデル①: 秘密情報の漏洩 — なぜ漏れないか

### 平文 nsec は「そもそも永続化されない」

- **直接モード**: `NostrKeyInfo` に保存されるのは `credentialId` + `pubkey` + `salt` のみ（`types.ts:23-38`）。秘密鍵は毎回 WebAuthn PRF から再導出され、ディスクには一切残らない。localStorage を丸ごと盗んでも、対応するパスキー＋ユーザー検証（UV）なしには鍵を再現できない。
- **wrap モード**: インポートした nsec は NIP-44 v2 で暗号化され（`nosskey.ts:597`）、`wrapped.payload` として保存される。KEK は PRF 由来で保存されない。したがって保存値は「PRF を出せるパスキー＋UV」がなければ復号できない暗号文にすぎない。

**結論**: ストレージ（localStorage / cookie ミラー）が奪われても、秘密鍵の漏洩には至らない。攻撃者はさらに被害者のオーセンティケータと生体/PIN による UV を突破する必要があり、これは WebAuthn の保証範囲。

### メモリ上の秘密は徹底してゼロ化される

- `#getSecretKey` / `createNostrKey` / `importNostrKey` はすべて `try/finally` で PRF・KEK・nsec バッファを `.fill(0)` する（`nosskey.ts:533-537, 606-615, 792-796`）。
- `KeyCache` はエントリ破棄・TTL 満了・上書きのいずれでも `#clearKey` でゼロ化（`key-cache.ts:159-171, 198-200`）。
- `PendingPrfCache`（create 直後の未消費 PRF）は TTL 60 秒での自動ゼロ化・消費時の相方即時ゼロ化・`clearAll` を備え、秘匿バイトを heap に放置しない設計（`pending-prf-cache.ts` 全体）。`consume` が**同期**である旨がコメントで固定され、hit と使用の間に TTL 発火が割り込む競合を構造的に排除している。
- `consume` は同期完結のため、await 挿入による TOCTOU（値ゼロ化との競合）が起きないことをコメントで明示・強制。

唯一の既知の限界は `exportNostrKey` が hex **文字列**を返すため呼び出し後にゼロ化できない点（JS の文字列不変性による、L-5 として既知）。エクスポートは常に UV を強制（`bypassCache: true`, `nosskey.ts:656`）するため露出はユーザー明示操作時のみ。

### 暗号プリミティブが会話鍵・per-message 鍵を外に出さない

- NIP-44 v2 会話鍵と per-message 鍵は **module 内 private** で、SDK バレルから再エクスポートされない（`nip44.ts:35-69` のコメントで意図明記）。生の鍵素材を呼び出し側に渡さないことで nonce 再利用・鍵混同の footgun を封じている。
- MAC 比較は constant-time（`nip44.ts:117-122`）。
- ECDH 共有 X は毎回 `slice()` で独立バッファとして返し、noble 内部バッファへのエイリアスを避ける（`secp-utils.ts:54-55`）。

### iframe / postMessage 経由で応答が漏れない

- host の応答は `source.postMessage(response, { targetOrigin: event.origin })`（`host.ts:229-233`）。`event.origin` はブラウザが付与する信頼できる値で、返信は必ず要求元オリジンにのみ届く。`allowedOrigins:'*'`（オープン埋め込み）でも、応答が第三者オリジンに漏れることはない。
- client 側は `event.source !== iframe.contentWindow` と origin 不一致を二重で弾く（`client.ts:322-328`）。
- **エラーメッセージに秘密は載らない**: `hexToBytesStrict` は意図的にエラーへ入力値を含めない（`utils.ts:93-95, 101-111`）。NIP-44 の失敗は "invalid MAC" 等の定型文のみ。host が親へ返す `INTERNAL` エラーの `err.message` を追跡したが、鍵素材・平文を含む経路は無かった。

### プライバシー: サイレントな npub 取得は塞がれている（H-1 対応済みを確認）

- `getPublicKey` / `getRelays` が `CONSENT_REQUIRED_METHODS` に含まれ（`protocol.ts:35-43`）、host の全メソッドが `#withVisibilityAndConsent` を通る（`host.ts:258-307`）。任意サイトが不可視 iframe を埋め込むだけで npub / リレー設定をサイレント取得することは**できない**。
- 例外は「情報を持たない空マップ」を返すケースのみ（`onGetRelays` 未設定 or 未ログイン、`host.ts:264-271`）。これは識別情報ゼロなので同意不要で妥当。

---

## 攻撃モデル②: ユーザーの意図しない操作の誘発 — なぜ起きないか

### すべての機微メソッドが同意ゲートを通る

- 署名・暗号化・復号・接続（getPublicKey/getRelays）の 7 メソッドすべてが `#withVisibilityAndConsent` 経由で、`requireUserConsent:true`（既定）なら `onConsent` の truthy 解決が必須（`host.ts:352-384`）。`onConsent` 未設定はフェイルクローズ（`INTERNAL`、`host.ts:358-363`）。
- **署名対象は改ざん不能**: 親から postMessage で渡る `event` は構造化複製されたコピーで、送信後に親が書き換えられない。同意ダイアログが表示する `event` と、実際に `manager.signEvent(event)` に渡る `event` は同一参照（`host.ts:273-281`）。表示と署名内容が食い違う TOCTOU は無い。
- 同意ダイアログは origin / メソッド / イベント種別 / content（100 字トランケート）/ tags / 相手 pubkey を提示し（`ConsentDialog.svelte:83-153`）、**Svelte の既定エスケープ**でレンダリングされる。`{@html}` は本コンポーネントに無く、悪意ある event.content による XSS は成立しない。

### 復号オラクル化を「常に許可」で恒久化できない（M-1 対応済みを確認）

- `evaluateConsent` は `nip44_decrypt` / `nip04_decrypt` を `always` ポリシー・信頼済みオリジンによるサイレント承認の対象外とし、**毎回ダイアログを強制**（`consent-gating.ts:74-75`）。`deny` のみ短絡可。
- ダイアログ側も復号では「常に許可」ボタンを出さない（`ConsentDialog.svelte:159-165`）。多層防御として `rememberOriginIfRequested` も復号を信頼リストに載せない（`iframe-mode.ts:38-39`）。
- 復号は「任意の暗号文を平文化できる不可逆オラクル」であり、暗号化（送信内容が可視）と非対称、という設計判断が一貫して実装されている。

### 同意疲れ・ダイアログ連打への構造的歯止め（M-4 対応済みを確認）

- host にオリジン単位の連続拒否ブロックを実装（`host.ts:390-424`）。同一オリジンから既定 5 回連続拒否で 60 秒間、以降の同意要求をダイアログ非表示のまま `RATE_LIMITED` で短絡（`host.ts:364-367` でダイアログ表示・iframe 可視化の**前**にブロック判定）。1 回でも承認でカウンタリセット。SDK パッケージ側の防御なので全統合者に効く。
- `deny` ポリシーの自動拒否は `denyCounts` で可視化され（`iframe-mode.ts:64-74`, `app-state.ts:105-118`）、サイレントなプロービングをユーザーが観測できる。

### 設定改ざんが同意ゲートを弱体化させない

- 信頼済みオリジン・同意ポリシー・キャッシュ TTL はすべて localStorage 上で改ざん可能だが、読み込み時に型ガードとクランプで無害化する:
  - TTL は `clampCacheTimeout` で 10〜3600 秒へ強制、NaN/Infinity は既定値へ（`secret-cache-settings.ts:31-36`）。M-3 の推奨どおり上下限が入っている。
  - 信頼済みオリジンは配列・`origin:string`・`methods:PolicyKey[]` を検証し、壊れた要素を除外（`app-state.ts:167-199`）。
  - 同意ポリシーは各キーを `isConsentDecision` で検証し、不正値は安全側の `ask` へ降格。**降格が起きたら黙らず** `markCorruption` で Settings 画面に可視化（`app-state.ts:202-226, 158-164`）。セキュリティ設定の沈黙降格を避ける方針が徹底されている。

### CSP による XSS 多層防御（M-3 対応済みを確認）

- `script-src 'self'`（`'unsafe-inline'` 無し）を核に、`object-src 'none'` / `base-uri 'self'` / `form-action 'self'` を設定（`csp.ts:22-33`）。本番は `public/_headers`（Cloudflare Pages）、dev/preview は Vite プラグインで同一値を配信し、`csp.spec.ts` が両者の一致を検証。
- `frame-ancestors *` はオープン埋め込みモデルの設計意図（ここを閉じると iframe モードが壊れる）。iframe 経路の防御は CSP ではなく同意ゲート＋PRF の origin バインドが担う。

---

## 攻撃モデル③: なりすましによるログイン — なぜ成立しないか

### 有効な署名は sig↔pubkey のバインドにより実鍵でしか作れない

> **訂正（依存ソース実測後）**: 当初「`seckeySigner` は親由来の `pubkey`/`id`/`sig` を無視して秘密鍵から再計算する」と記したが、これは**誤り**。`@rx-nostr/crypto` の実装（`node_modules/@rx-nostr/crypto/src/signer.ts:25-45`）は `pubkey: params.pubkey ?? pubhex` と、`id`/`sig` も `?? ` フォールバックで、**呼び出し側が与えた値を優先**する。さらに `id`/`sig`/`kind`/`pubkey`/`content`/`created_at`/`tags` が全て揃うと `ensureEventFields` が真になり**署名も検証もせずイベントをそのまま返す**。結論（なりすまし耐性）は下記の別機構で成立するため変わらないが、根拠を差し替える。

- 実測（`seckeySigner(sk).signEvent(...)` を直接実行）で確認した挙動:
  - **通常**（kind/content/tags のみ）→ `pubkey` は実鍵由来、`sig` は実鍵で計算、`verify` = **true**（正しい署名）。
  - **親が `pubkey` を偽装**（id/sig 無し）→ 返る pubkey は偽装値だが、`sig` は実鍵が算出するため `schnorr.verify(sig, id, 偽装pubkey)` が**失敗**し `verify` = **false**（無効イベント）。
  - **親が id/sig 込みの完全イベント**→ そのまま返る（署名されない）。攻撃者は元々持っていた（無効な）イベントが返るだけで、新たな有効署名は得られない。
- したがって **他人になりすました「有効な」署名イベントは生成できない**。Nostr の検証は `sig` と `pubkey` のバインドを要求し、実鍵で作った `sig` は実鍵の pubkey でしか検証を通らないため。有効署名が生成されるのは「sig 省略 → 実鍵で計算」かつ「pubkey が実鍵由来」の経路のみで、その場合の署名対象（kind/tags/content）は同意ダイアログの表示と一致する（WYSIWYS 成立）。
- 署名鍵自体は常に `#getSecretKey` 経由で PRF から解決され（`nosskey.ts:630`）、親由来データが鍵導出に混入することはない。

### PRF は rpId（origin）にバインドされ、フィッシング耐性を持つ

- PRF 出力はオーセンティケータが `rpId`（既定でその文書の origin）ごとに決定的に導出する。偽サイトが別 origin で**偽の iframe** を立てても rpId が異なり、同じ credentialId でも**異なる PRF**しか得られず、被害者の鍵を再現できない。
- 被害者の**本物の iframe**（nosskey.app）を埋め込む経路は、③のなりすまし操作すべてが②の同意ゲートで守られる。UV（生体/PIN）も要求される。

### wrap 復号後の pubkey 整合性検証で identity すり替えを検知

- wrap モードでは復号した nsec から pubkey を再導出し、保存済み `keyInfo.pubkey` と一致するか検証（`nosskey.ts:785-791`）。localStorage 上の `pubkey` が改ざんされて偽の npub を表示させられても、署名前に throw して不正鍵の生成を止める。別パスキー/別 keyInfo の取り違えも同時に検知。
- 復号結果は `hexToBytesStrict(nsecHex, 32)` で長さ・hex 妥当性を強制（`nosskey.ts:778`）。MAC 検証（NIP-44）に加えた多層防御。

### 改ざんされ得る保存値は厳格パースする

- `credentialId` / `salt` / 復号済み `nsec` のパースは、非 hex を黙ってスキップし奇数長を切り詰める寛容な `hexToBytes` ではなく、**厳格版** `hexToBytesStrict` を使う（`nosskey.ts:759-763, 778`）。peer pubkey も `secp-utils.ts:24-27` で 64 hex 厳格検証。
- マルチアカウント登録簿は `isNostrKeyInfo` 型ガードで壊れた/悪意ある要素を読み込み時に除外（`key-registry.ts:26-39, 67-81`）。`pubkey + credentialId` 複合キーで、同一 nsec を複数パスキーで wrap したエントリの取り違え・喪失を防ぐ。

### プロフィール表示のなりすまし防止

- 外部リレーから取得した kind:0 は schnorr 署名を検証し（`profile-fetcher.ts:171-182`）、`pubkey` 一致も確認（`:188`）してから採用。悪意あるリレーが他人になりすました kind:0 を返しても画像・名前として表示しない。

---

## 残存リスク（severity 付き）

### 🟡 M-2（継続）: wrap モードの暗号化 nsec は localStorage が唯一のコピー

- **箇所**: `key-registry.ts`（設計）、インポート導線（`AuthScreen.svelte` / `ImportKeyInfo.svelte`）
- **脅威**: アカウント喪失（③の裏返し＝正規ユーザーが締め出される）
- **内容**: インポート済み nsec の暗号文はローカル（localStorage＋Safari 向け cookie ミラー）にしか存在しない。サイトデータ消去・プロファイル削除・cookie 期限切れで**復元不能**になる。`backupKeyInfo()` とエクスポート UI はあるが**任意操作**で、wrap インポート完了時にバックアップを促す/強制する導線は今回も未実装であることを確認（`ImportKeyInfo.svelte` に backup/download の語が無い）。
- **推奨**: wrap 鍵作成直後にバックアップファイルのダウンロードを必須ステップにする。前回から状況変化なし。

### 🟢 Low（実害限定・継続）

| # | 箇所 | 内容 |
| - | ---- | ---- |
| L-6 | `examples/parent-sample/src/ui.ts:115-126` | `installModalVisibilityListener` が `nosskey:visibility` 受信時に `event.origin` / `event.source` を未検証。第三者 iframe がモーダルの表示/非表示を撹乱できる。サンプルアプリ・実害は UI 撹乱のみだが**前回 L-6 から未修正**。SDK 本体（`client.ts`）は source+origin を検証済みで無関係。 |
| L-7 | `host.ts:201-205, 426-431` / `IframeHostScreen.svelte:32-36` | `nosskey:ready` / `visibility` を `targetOrigin:'*'` で送信。内容は boolean のみで実害小だが、Nosskey 利用の事実が任意の親に漏れる。オープン埋め込みでは親 origin を送信前に知り得ないため構造的トレードオフ。 |
| L-8 | `client.ts:326` | `if (event.origin && ...)` が空 origin を素通し。直前の `event.source` 検証で実害はほぼ無いが条件が不要に緩い。 |
| L-3 | `utils.ts:54-77` | 直接モードの `keyInfo.pubkey` は保存時に非認証。改ざんされると `getPublicKey()` が偽 npub を返し、署名は実鍵で行われるため表示 ID と署名鍵が食い違う。wrap モードは pubkey 検証で検知するが直接モードは未検証（別鍵導出になるだけで漏洩は無い）。localStorage 書き込み権限を前提とする低リスク。 |
| **L-13（新規）** | `nosskey.ts:624-639` / `host.ts:273-281` | `signEventWithKeyInfo` が親（オープン埋め込みでは任意オリジン）由来の `event` を**サニタイズせず** `seckeySigner.signEvent` に渡す。`@rx-nostr/crypto` は `pubkey: params.pubkey ?? pubhex` で呼び出し側 pubkey を honor し、`id`/`sig` が揃うと署名せずパススルーする（`signer.ts:25-45`）。**実害は無効イベントが返るだけ**（sig↔pubkey バインドで有効署名にならない・秘密漏洩無し・WYSIWYS も成立）だが、多層防御として host または SDK が署名前に `id`/`sig`/`pubkey`（必要なら `created_at`）を除去し、返却イベントが「同意した内容を実鍵で署名したもの」であることを構造的に保証するのが望ましい。 |
| L-9 | `ConsentPolicySettings.svelte` | `{@html}` 使用箇所。現状の挿入値は数値のみで安全だが、i18n 文字列が信頼境界に入る構造。slot 化を推奨。 |
| L-11 | `.github/workflows/*.yml` | Actions がタグ参照（`@v4` 等）で SHA ピン留めなし。サプライチェーン強化として SHA 固定を推奨。 |
| L-12 | `nip04.ts` | NIP-04（AES-CBC 認証なし）は padding oracle 等の既知の弱さを持つが、レガシー互換専用と明記し新規利用を非推奨化済み（`nip04.ts:9-17`）。現状の扱いで妥当。 |

---

## 確認済み・問題なしの主要項目（今回再検証）

- **前回 High/Middle の対応が実在すること**: H-1（接続承認）/ M-1（復号は常に確認）/ M-3（CSP + TTL クランプ）/ M-4（連続拒否レート制限）/ M-5（`allowedOrigins` 未指定 throw）をコードで確認。
- **秘密のゼロ化**: PRF / KEK / nsec / キャッシュ / pending PRF のすべての破棄経路で `.fill(0)`。
- **NIP-44 v2**: constant-time MAC 比較、会話鍵/per-message 鍵の非公開化、`#` バージョンプレフィクス拒否、padding 長検証。
- **postMessage**: host 応答は要求元 origin 限定、client は source+origin 二重検証、型ガード（`isNosskeyRequest` 等）で不正メッセージを弾く。
- **署名のなりすまし不能性**: 署名鍵は常に PRF 由来。親由来 pubkey/id/sig は `seckeySigner` が honor するが、sig↔pubkey バインドにより攻撃者操作イベントは schnorr 検証に失敗し、有効な偽署名は生成不能（実測確認・L-13 で多層防御を推奨）。
- **フィッシング耐性**: PRF が rpId（origin）にバインド。
- **設定改ざん耐性**: TTL クランプ・型ガード・沈黙降格の可視化。
- **依存関係**: `npm audit` 脆弱性 0 件（本番・全体）、noble 系・週次 audit CI。

## 優先対応の提案

1. **M-2**: wrap モードインポート完了時のバックアップ必須化（唯一残る Middle。アカウント喪失＝正規ユーザーのなりすまし被害の裏返しであり、UX ではなくセキュリティ課題として扱う）。
2. **L-6**: `parent-sample` の visibility リスナーに origin/source 検証を追加（SDK 利用者の参照実装として、検証パターンを示す意義がある）。
3. **L-11**: GitHub Actions の SHA ピン留め。
