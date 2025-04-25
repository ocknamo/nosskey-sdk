# WebAuthn（パスキー）によるNostr秘密鍵の安全な保管とイベント署名

## 目次

- [背景・目的](#背景目的)
- [WebAuthnパスキーによるNostr秘密鍵保管・利用の可能性](#webauthnパスキーによるnostr秘密鍵保管利用の可能性)
  - [WebAuthnの仕組み](#webauthnの仕組み)
  - [Nostr鍵への直接利用の可否](#nostr鍵への直接利用の可否)
  - [パスキーの間接利用](#パスキーの間接利用)
- [秘密鍵の導出・ラップ・アンラップによるセキュアなワークフロー](#秘密鍵の導出ラップアンラップによるセキュアなワークフロー)
  - [全体フロー概要](#全体フロー概要)
  - [パスキー登録と秘密鍵生成](#パスキー登録と秘密鍵生成)
  - [秘密鍵のラップ（暗号化保存）](#秘密鍵のラップ暗号化保存)
  - [署名要求時のアンラップと署名](#署名要求時のアンラップと署名)
- [WebAuthn経由での署名処理とユーザーエクスペリエンス](#webauthn経由での署名処理とユーザーエクスペリエンス)
- [JavaScriptとWebAuthn APIによる実装可能性と技術的制限](#javascriptとwebauthn-apiによる実装可能性と技術的制限)
  - [対応アルゴリズム](#対応アルゴリズム)
  - [WebAuthn拡張機能](#webauthn拡張機能)
  - [クレデンシャルの扱い](#クレデンシャルの扱い)
  - [JavaScript制約](#javascript制約)
- [セキュリティ上の考慮点](#セキュリティ上の考慮点)
  - [パスキーのクラウド同期](#パスキーのクラウド同期)
  - [キーロガー対策](#キーロガー対策)
  - [リプレイ攻撃とチャレンジ管理](#リプレイ攻撃とチャレンジ管理)
  - [ブラウザ間の差異](#ブラウザ間の差異)
- [まとめ](#まとめ)

## 背景・目的

Nostrプロトコルではユーザーの身元を識別しイベントに署名するために秘密鍵が必要ですが、この秘密鍵の流出は致命的なセキュリティリスクとなります ([Nostrkey - a program for nostr identities with hardware protection · Timelessness](https://www.timelessness.co/blog/nostrkey/))。

一方、WebAuthn（パスキー）は秘密鍵をデバイス内（セキュアチップやOSのキーストア等）に安全に保持し、公開鍵認証を実現する技術です。WebAuthnを用いればユーザーに秘密鍵管理を意識させずに安全な署名操作を行える可能性があります。

ここでは、WebAuthn対応ブラウザ環境でNostrの秘密鍵を直接または間接的に保存・利用する手法を調査し、セキュアなワークフローの構築案を検討します。また、実装上のポイントやセキュリティ留意点、関連する既存プロジェクトについても解説します。

## WebAuthnパスキーによるNostr秘密鍵保管・利用の可能性

### WebAuthnの仕組み

WebAuthnでは、ウェブサイト（RP: Relying Party）での登録時にAuthenticator（デバイス）が鍵対を生成し、秘密鍵はデバイス内に留まり公開鍵だけがサーバに提供されます ([Using WebAuthn for Signing](https://webauthn.guide/))。

以降の認証（署名）では、サーバがランダムなチャレンジをAuthenticatorに送り、Authenticatorが秘密鍵でそれに署名して応答します。この際、生成される署名はチャレンジだけでなくAuthenticator固有のデータ（RP IDやカウンタ等）も含めた値に対するものです。

WebAuthnはもともとユーザ認証用に設計されていますが、この仕組みを応用して任意のデータに対するデジタル署名に利用することも可能です。実際Yubicoは、WebAuthnで提供される署名フローをファイル署名などに転用するコンセプトを公開しています。

### Nostr鍵への直接利用の可否

Authenticatorが対応するアルゴリズムで鍵対を作成できれば、その鍵をNostrの鍵として使うことも考えられます。例えば一部のセキュリティキー（YubiKey 5.2以降など）はEd25519（EdDSA）キーの生成に対応しています ([Algorithms](https://www.w3.org/TR/webauthn-2/#sctn-alg-identifier))。

WebAuthn登録時にCOSEアルゴリズム識別子-8（EdDSA, Ed25519）を指定すれば、Authenticator上にEd25519の秘密鍵を生成し取得した公開鍵をNostrの公開鍵（npub）として利用できます。こうすることで秘密鍵自体はデバイスから出ず、以後の署名要求はWebAuthn経由で行われます。

ただしそのままでは課題もあります。WebAuthnの署名結果は前述のようにチャレンジとAuthenticatorデータに対するものとなり、Nostrイベントのハッシュに対する純粋な署名とはフォーマットが異なります。標準のNostrクライアントやリレーは、イベントID（SHA-256ハッシュ）に対するEd25519署名を想定しているため、WebAuthnが返す署名をそのまま検証できません。このため、WebAuthn鍵を直接Nostrイベント署名に使うのは難しく、Nostrプロトコル側で特別な対応をしない限り互換性に問題が生じます。

### パスキーの間接利用

WebAuthnを間接的に利用して秘密鍵を保護するアプローチが現実的です。具体的には、Nostr用の秘密鍵（Ed25519, secp256k1等）自体は従来通り生成しつつ、それをWebAuthn Authenticator由来の鍵で暗号化（ラップ）して保管します ([GitHub - susumuota/nostr-keyx](https://github.com/susumuota/nostr-keyx))。

署名が必要な際にのみWebAuthnを用いて復号（アンラップ）し、一時的に秘密鍵を利用する方式です。この方法であればNostrネットワーク上で扱う署名フォーマットは通常通りで、WebAuthnはあくまでローカル環境で秘密鍵を安全に取り扱うためのキーマスター役となります。

## 秘密鍵の導出・ラップ・アンラップによるセキュアなワークフロー

### 全体フロー概要

WebAuthnの拡張機能やWeb Cryptography APIを組み合わせることで、Nostr秘密鍵の安全なラップ/アンラップ処理を実現できます。その鍵となるのがWebAuthn Level3で定義されたPRF拡張（Pseudo-Random Function extension）です ([Matt's Headroom | Encrypting Data in the Browser Using WebAuthn](https://matteopacini.com/blog/encrypting-data-in-the-browser-using-webauthn/))。

この拡張を用いると、Authenticator内の秘密に基づき安定したハッシュ値（HMAC）を取得できます。一度登録したパスキーに対し、常に同じ入力バイト列を与えれば、毎回同じ出力が得られるため、これを鍵導出の基材として利用できます。

以下の手順でワークフローを構築します。

### パスキー登録と秘密鍵生成

初回利用時にユーザーはWebAuthnによりパスキーを登録します。`navigator.credentials.create()`を使い、`pubKeyCredParams`に希望するアルゴリズム（例：Ed25519のalg: -8やsecp256k1に対応するECDSA（ES256）のalg: -7など）を指定します。

Authenticatorがそれに対応していれば鍵対が生成され、公開鍵が得られます。並行して、Nostr用の秘密鍵ペア（32バイトのシードなど）もアプリ側で生成します（既存のnsecをインポートする場合もこのタイミングで入力）。生成したNostr秘密鍵は平文のまま保持せず、直ちに次のステップでラップします。

### 秘密鍵のラップ（暗号化保存）

WebAuthn登録時または直後の認証時に、AuthenticatorのPRF拡張を用いて鍵導出鍵を取得します。具体的には、`navigator.credentials.get()`を呼び出し、`publicKey.extensions`で`prf`に例えば`eval: { first: saltBytes }`を指定します（`saltBytes`は適当な固定バイト列）。

ユーザーが認証（タッチや生体認証）を行うと、レスポンスの`getClientExtensionResults().prf.results.first`に32バイト長程度のハッシュ値が得られます。これはAuthenticator内の秘密鍵と提供したバイト列から計算された高エントロピーなバイト列です。

次にWeb Cryptoの`subtle` APIでこのバイト列を鍵素材としてインポートし、HKDFなどのKDFで対称鍵を導出します。この鍵を使い、先ほど生成したNostr秘密鍵をAES-GCMなどで暗号化（鍵ラップ）します。

こうして得た暗号化データと必要なメタ情報（IVやsalt）は安全なストレージ（例えばIndexedDB）に保存し、元の平文秘密鍵はメモリから消去します。

**重要点**: 導出に用いたsaltやHKDFの情報（info）は後で再現するため一定にしておき、またAuthenticator側ではユーザー検証（UV）を必須にしておくことで、セキュリティを高めます。

### 署名要求時のアンラップと署名

イベントに署名する際は、再び`navigator.credentials.get()`を呼び出してPRF拡張の出力を取得します（同じsalt等を使えば同じ出力が得られる）。Web Cryptoにより以前と同じ対称鍵を導出し、保存していた暗号化された秘密鍵を復号します。

これにより、署名処理の瞬間だけNostr秘密鍵が平文で復元されます。アプリはその鍵でイベントハッシュに署名し（例えばEd25519署名）、得られた署名値をイベントオブジェクトに格納します。署名後、平文鍵は速やかにメモリから削除します（ガベージコレクタ任せでなく明示的にバッファをゼロ化するとなお良い）。

この一連の処理により、ユーザーは秘密鍵の存在を意識せず、裏で必要なときだけ復号・利用される形になります。

#### 簡略化した擬似コード例: PRFで導出した対称鍵で秘密鍵をラップ

```javascript
const credId = /* 登録時に保存したCredential ID */;
const salt = new Uint8Array([/* 任意の固定バイト列 */]);

// WebAuthnでPRF拡張を使用し、派生キー素材を取得
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: new Uint8Array(32),  // チャレンジ（適当でOK。拡張のみ利用）
    allowCredentials: [{ id: credId, type: "public-key" }],
    userVerification: "required",
    extensions: { prf: { eval: { first: salt } } }
  }
});
const prfOutput = assertion.getClientExtensionResults().prf.results.first;
// HKDFで対称鍵（AES-GCM 256bit）を導出
const keyMaterial = await crypto.subtle.importKey("raw", prfOutput, "HKDF", false, ["deriveKey"]);
const aesKey = await crypto.subtle.deriveKey(
  { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: new TextEncoder().encode("nostr key") },
  keyMaterial,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"]
);
// Nostr秘密鍵をAES-GCMで暗号化（ラップ）
const iv = crypto.getRandomValues(new Uint8Array(12));
const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, nostrPrivKeyBytes);
// --- ciphertextとivを保存、nostrPrivKeyBytesは消去 ---
```

上記のようにしておけば、復号時も同様に`crypto.subtle.decrypt`を呼び出すだけで秘密鍵を得られます。

**ポイント**: PRF拡張の出力は同じクレデンシャルと入力に対して常に不変なので、ユーザーごとに固定のsalt（例えば文字列"nostr-key-salt"をUTF-8エンコードしたもの等）を用いれば、各ユーザーの秘密鍵を決定論的に復元できます。

この仕組みはまさにパスワードマネージャ等で「パスキーでデータ復号」を行うのと同様であり、BitwardenではこのPRF拡張を用いてマスターパスワードなしでVaultを復号する実験的機能を実装しています ([Login with Passkey, "Use for vault encryption" - Bitwarden Community Forums](https://community.bitwarden.com/t/login-with-passkey-use-for-vault-encryption/50619/62))。

## WebAuthn経由での署名処理とユーザーエクスペリエンス

上記ワークフローにより、ユーザーは鍵管理を意識せずNostrイベントに署名できます。署名のたびに行う操作はWebAuthn認証とほぼ同じで、例えば「パスキーで承認」のブラウザUIが現れ、指紋認証やYubiKeyタッチをするだけです。

秘密鍵の生成や保存、暗号化・復号は全て裏で行われ、ユーザーは自分の生体情報やPINで承認している感覚しかありません。これはパスキーによるパスワードレス認証と似たUXでありながら、実際にはアプリ内部でNostr署名に利用されている状態です。

認証プロンプトもWindowsやAndroidでは「生体認証してください」、iOSでは「～がパスキーを使用しようとしています」といった標準UIであり、ユーザーには「投稿の送信を承認している」程度の認識で済みます。

## JavaScriptとWebAuthn APIによる実装可能性と技術的制限

### WebAuthn拡張機能

実装ではHMAC-secret拡張やPRF拡張を利用します。現在主流のブラウザではHMAC-secret拡張（`extENSIONS: { "hmacCreateSecret": true }`）によって同様の「クレデンシャルに紐付く共有秘密」を取得する手段が提供されています。

さらにWebAuthn Level 3のPRF拡張はChromeでは実験実装から標準実装へ進みつつあり、Safari 17〜18やiOS 17以降で対応が追加されました（2024年時点）([Automatic Passkey Upgrade & WebAuthn PRF Extension - Medium](https://medium.com/p/6655505bc595))([Passkeys and PRF extension - Apple Developer Forums](https://developer.apple.com/forums/thread/728807))。

しかし対応状況にはばらつきがあります。Bitwarden社の報告によれば、iOS（AppleのプラットフォームAuthenticator）やWindows Helloは2024年初頭の時点でPRF未対応でした。Chrome（クロミウム）は対応を進めていますが、OS側のAuthenticatorが対応しないと意味が無いため、実際にPRF拡張を使えるのはYubiKeyなど一部のセキュリティキーや、Androidの一部実装に限られていました。

幸いHMAC-secret拡張自体はWindows HelloやAppleデバイスでも既存実装が多く、実験的に同等のこと（対称鍵の取得）に使われています。いずれにせよ、PRF拡張対応ブラウザ・Authenticatorの組合せで動作させる必要があり、実装時には環境要件を明示する必要があります。

### クレデンシャルの扱い

WebAuthnで生成したクレデンシャルIDや公開鍵はブラウザ側で保持できますが、Nostrアプリ側でもユーザーごとにこれらを保存しておく必要があります。特にクレデンシャルID（`credential.id`）は後で署名要求（`navigator.credentials.get()`）するときの指定に使うため、例えばIndexedDBに紐付けて保存します。

また、RP ID（一般にドメイン名）は固定であり、同一RP ID内なら「Discoverable（紐付け可能）クレデンシャル」としてユーザー名なしでサインインできるパスキーもありますが、基本的には同一オリジンでしか既存クレデンシャルを再利用できないことに留意が必要です。

つまり、あるWebアプリで登録したパスキーは別のドメインのWebアプリからは使えません（セキュリティ上当然の制約）。そのため、NostrクライアントWebアプリごとにユーザーは個別にパスキー登録を行う必要があります（これは従来の拡張機能ベース鍵管理でも同様の課題です）。

将来的にマルチドメインで使える共有クレデンシャルの仕組み（例：ウェブ外部で動作する共通サインサービス）ができれば改善しますが、現行仕様では困難です。

### JavaScript制約

WebCrypto APIでは2025年時点でもEd25519やsecp256k1といったモダン非対称鍵のネイティブサポートは限定的です（標準化途上のため、現在は実装依存）。そのため、Nostr秘密鍵を用いた署名は、例えば@noble/secp256k1やtweetnaclなどの純粋JSライブラリで行う場合が多いでしょう。

これらライブラリは高速ですが、平文の秘密鍵を扱う際はメモリ上に露出するため、前述の通り使用後のメモリ消去など対策が望まれます。

また、WebAuthn API自体にもユーザー操作要求（ユーザージェスチャー）の制約があります。`navigator.credentials.create/get`は基本的にユーザーアクション（クリックハンドラ内など）からでないと呼び出せません。これは悪意あるスクリプトが背後で勝手にパスキー認証を出さないようにするためですが、Nostrクライアントでは通常「送信ボタン」をユーザーが押すため問題になりにくいでしょう。ただし自動投稿のようなシナリオでは自動では動かせない点に注意が必要です。

さらに、認証器によってはユーザープレゼンス（UP）確認のみで署名が行われる場合（ボタンタッチのみ）と、**ユーザー検証（UV）**まで要求される場合（PINや生体認証あり）があります。実装側で`userVerification: "required"`と指定すれば必ずUVが要求され、なければエラーとなります。

セキュリティ上はUV必須が推奨ですが、UX的には「毎回指紋認証/顔認証させられるのは煩わしい」という声も考えられるため、要件に応じた設定が必要です。

## セキュリティ上の考慮点

WebAuthnとパスキーを用いることで、従来の秘密鍵管理と比べ大幅にセキュリティが向上しますが、依然考慮すべき脅威は存在します。

### パスキーのクラウド同期

「パスキー」は多くの場合クラウドを通じてデバイス間同期されます。例えばAppleのパスキーはiCloudキーチェーンで同期され、GoogleのPasskeyも同様にGoogleアカウント経由で複製されます。

同期は利便性を高め、スマートフォンで作成した鍵をPCで使えるといったメリットをもたらします。しかし、クラウド同期に伴うリスクも考慮しましょう。

メーカー各社はパスキー同期データはエンドツーエンドで暗号化されており、本人以外アクセス不可と謳っています ([About the security of passkeys - Apple Support](https://support.apple.com/en-ca/guide/security/sec100e2fde5/web))。それでも万一クラウドストレージが侵害された場合に鍵が漏洩する可能性や、ユーザーの別デバイス（スマートフォン等）が乗っ取られた場合に同じパスキーで署名されてしまうリスクがあります。

極力リスクを減らしたい場合、**デバイス同期を行わないセキュリティキー（デバイスバウンド鍵）**を使用する選択もあります ([Device-Bound vs. Synced Passkeys - Corbado](https://www.corbado.com/blog/device-bound-vs-synced-passkeys))。例えばYubiKeyなどのハードウェアキーを使えば物理的に所有する限り秘密鍵はそのデバイス内に留まり、クラウドには保存されません。

パスキー利用時には、この同期の挙動についてユーザーへの周知（「この鍵は他の自分の端末と共有されます」等）や、場合によってはプラットフォームごとの設定（ブラウザごとのオプトアウトが可能ならそれを案内）が必要です。

