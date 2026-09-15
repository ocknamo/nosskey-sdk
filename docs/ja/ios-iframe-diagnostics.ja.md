# iOS / WebKit ストレージ分離の実機切り分け手順

「iframe 埋め込み経由の iPhone で、パスキーログインが成立しない（`NO_KEY` になる）」
という報告を切り分けるための計測モードと、その読み方をまとめる。

対象の症状は `docs/todo.md` の P1 項目「[iOS] iframe から鍵情報が見えない時間が長い
（WebKit のストレージ分離）」に対応する。**本モードは計測専用であり、原因に対する
修正は何も含まない。**

## なぜ専用モードが要るか

iPhone は DevTools を開けない。Mac の Web インスペクタでリモートデバッグする手も
あるが、それができない場面（現地での再現、他人の端末、アプリ内ブラウザ）でも
ログを採る必要がある。そこで [console-daijin](https://github.com/ocknamo/console-daijin)
のオンページパネルをページ内に出し、判定の分岐をそこへ流す。

## 有効化

URL に `debug=1` を付ける。下表のいずれの書き方でも受理する。

| 経路 | URL 例 |
|------|--------|
| 単体（スタンドアロン） | `https://nosskey.app/?debug=1#/account` |
| iframe を直接開く | `https://nosskey.app/?debug=1#/iframe` |
| ハッシュ内クエリ | `https://nosskey.app/#/iframe?debug=1` |
| 親サンプル経由 | `https://ocknamo.github.io/nosskey-sdk/?debug=1` |

親サンプル（`examples/parent-sample`）を `?debug=1` で開くと、**接続時に iframe の
URL へ自動で `debug=1` を積む**（`withIframeDebugFlag()`）。親と iframe の双方で
パネルが立ち上がるので、スマホで URL を 2 つ打ち直す必要はない。

iframe 内から「セットアップを開く」で別タブへ飛ぶときも、`buildScreenUrl()` が
フラグを引き継ぐので、別タブ側でもパネルが出る。

計測モードのときは iframe を自動的に表示する（通常は親が `nosskey:visibility` を
受け取るまで `display:none` のため、パネルが見えないまま調査できなくなる）。

## 出力の読み方

パネルには 2 種類のログが出る。

### 1. 診断スナップショット

`boot` / `iframe: detectInitialState enter` / `iframe: applyStorageGrant done` の
3 つのタイミングで、同じ形の 6 行が出る。

```
where: https://nosskey.app/ route=/iframe framed=true secure=true
ua: Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) ...
webkitHeuristic=true storageAccessApi=available
localStorage: available=true (none)
cookie: total=3 len=812 nosskey:nosskey_pwk=430B/direct
manager: initialized=true storage=CookieStorage nosskey_pwk=430B/direct
```

各行の意味:

| 行 | 何を見ているか |
|----|----------------|
| `where` | origin・ハッシュルート・iframe の中か・secure context か |
| `ua` | UA 全文（`webkitHeuristic` の判定根拠。秘密ではないので全文出す） |
| `webkitHeuristic` | cookie フォールバック分岐に入る側かどうか。**実際の分岐と同じ関数**を使う |
| `storageAccessApi` | `document.requestStorageAccess` が存在するか |
| `localStorage` | 素の `window.localStorage`（iframe では partition された側） |
| `cookie` | `document.cookie`（SAA グラント後に unpartition される側） |
| `manager` | SDK が実際に読み書きしているハンドルとその中身 |

`localStorage` と `manager` を別々に出すのが要点。SAA グラント後は SDK のハンドルが
差し替わる（Chromium は SAA ハンドル、WebKit は `CookieStorage`）ため、両者の中身が
食い違う。その差分がどの経路で鍵が見えているかを直接示す。上の例は「素の
localStorage には無いが cookie 経由では見えている」＝ WebKit の cookie ブリッジが
効いている状態である。

`[nosskey:debug]` の行は**値を一切出さない。** 記録するのはキー名・バイト長・
モード種別（`direct` / `wrap` / `mixed` / `empty` / `unparsable`）だけ。
`NostrKeyInfo` に秘密鍵は含まれないが、`pubkey` と `credentialId` は利用者を
一意に特定できるため、スクリーンショットや貼り付けで外部へ渡ることを前提に伏せている。

この保証が及ぶのは `[nosskey:debug]` の行だけである。次節を必ず読むこと。

### 2. 分岐ログ

```
SAA: silent grant rejected DOMException/NotAllowedError: ...
SAA: requestStorageAccess({all:true}) returned {type: undefined, keys: null, isHandle: false}
SAA: applyStorageGrant {branch: webkit-cookie, userAgent: ...}
```

加えて、未捕捉例外と unhandled rejection も `[nosskey:debug] uncaught` /
`[nosskey:debug] unhandledrejection` として出る。`detectInitialState()` が
`NotAllowedError` 以外で reject すると状態カードが一切出ずに画面が固まる経路が
あり、その観測がこの調査の主目的のひとつであるため、ライブラリ任せにせず
自前で橋渡ししている（公開版 console-daijin 0.1.5 はこれらを拾わない）。

## ログの持ち出し

パネル右上のコピーボタンで全文をクリップボードへ取れる（クリップボードが
使えない文脈では textarea にフォールバックする）。

> **共有する前に全文を目視で確認すること。**
> パネルは `[nosskey:debug]` 行だけでなく、**アプリ全体の `console` 出力を
> 無差別に取り込む**。診断スナップショットが値を出さないことと、パネル全体が
> 安全であることは別問題である。起動時にもパネルへ同じ注意を 1 行出している。
>
> 例として、`bech32` の `decode()` は失敗メッセージへ入力文字列をそのまま
> 埋め込むため、打ち間違えた nsec が `console.error` に流れうる。本調査に
> 合わせて `utils/bech32-converter.ts` は例外名だけを出すよう直したが、
> 例外オブジェクトを丸ごと出す箇所は他にも残っている（`docs/todo.md` の
> 「console へ例外オブジェクトを丸ごと出している箇所の棚卸し」を参照）。

## 仮説 → 判定に使う値

| 仮説 | 判定に使う出力 | 仮説が正しいときの値 |
|------|----------------|----------------------|
| WebKit の 3rd-party localStorage は partition されたまま | iframe の `localStorage:` 行 | `available=true` だが `nosskey_pwk` が出ない（`(none)`） |
| カードが出ずに無言で死ぬ | `unhandledrejection` 行 | `DOMException/InvalidStateError` 等、`NotAllowedError` 以外が出る |
| SAA の前提（ジェスチャ / ファーストパーティ操作）を満たしていない | `SAA: silent grant rejected` と、許可タップ後の `SAA: manual grant rejected` | タップしてもプロンプトが出ずに `NotAllowedError` |
| cookie ブリッジが成立していない | スタンドアロンタブの `cookie:` 行 | `nosskey:nosskey_pwk` が出ない／`length` が 4096 に迫る／数日後に消える |
| SDK が鍵を見つけられていない | iframe の `manager:` 行 | `storage=...` の後ろが `(none)` |
| cookie のホスト不一致 | `where:` 行の origin | 登録したタブと iframe で origin が違う（`www.` 有無、`pages.dev`） |
| UA 判定漏れでフォールバックに入らない | `webkitHeuristic` と `applyStorageGrant {branch}` | iOS なのに `webkitHeuristic=false` / `branch: none` |
| `{all:true}` の戻り値で誤分岐 | `requestStorageAccess({all:true}) returned` | `isHandle: true` なのに鍵が見えない |

## 制約

- **HTTPS が要る。** `CookieStorage` は `Secure` 属性付きで書くため、`http://` の
  LAN 越しアクセスでは cookie ミラーが無言で失効する。WebAuthn も localhost 以外の
  平文 HTTP では動かないので、実機検証はデプロイ済みの HTTPS か HTTPS トンネルで行う。
- **デプロイが要る。** iframe 側のログはホスト（`nosskey.app`）のビルドに本モードが
  入っていないと出ない。
- console-daijin の**ログ転送機能は使っていない**。CSP の `connect-src` が
  `http://localhost:5959` を許可しておらず、そもそも実機から開発機の loopback へは
  届かないため。ログはパネルのコピーボタンで回収する。
- パネルは iframe 内では 120px に縮め、状態カードを上へ逃がす
  （`body.nosskey-debug-console`）。それでも表示は窮屈なので、長いログは
  コピーして読むこと。
- **計測は観測対象を書き換えない。** 診断は SDK の状態照会 API（`hasKeyInfo()` 等、
  メモリキャッシュと salt 書き戻しの副作用がある）を呼ばず、`MultiStorage` からは
  back-fill しない `peekItem()` で読む。`getItem()` で読むと cookie の値が
  localStorage へ実体化し、「partitioned localStorage に鍵が見えるか」という
  最重要の判定が偽陰性になるため。

## 関連

- `examples/svelte-app/src/debug/` — フラグ解決・パネル起動・診断スナップショット
- `examples/svelte-app/src/components/screens/IframeHostScreen.svelte` — 分岐ログの発火点
- `examples/parent-sample/src/debug.ts` — 親側のパネルとフラグ伝播
- `docs/ja/iframe-host.ja.md#storage-partitioning-と-storage-access-api` — 対象の仕組み
