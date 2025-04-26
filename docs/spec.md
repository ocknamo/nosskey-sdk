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
  - [NIP-49との互換性](#nip-49との互換性)
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

このPRF出力値を用いて、Nostr秘密鍵を暗号化します。暗号化方式としては、Nostrプロトコルで標準化されたNIP-49規格に準拠することで、クライアント間の互換性を高めることができます。

NIP-49に従い、PRF出力値から強力な対称鍵を導出し、それを使って秘密鍵をXChaCha20-Poly1305アルゴリズムで暗号化します。こうして得た暗号化データは標準化されたフォーマット（ncryptsec）でエンコードされ、安全なストレージ（例えばIndexedDB）に保存します。そして元の平文秘密鍵はメモリから速やかに消去します。

**重要点**: Authenticator側ではユーザー検証（UV）を必須にし、暗号化の計算負荷パラメータ（LOG_N）は環境に応じて適切な値を選択することでセキュリティを高めます。

### NIP-49との互換性

[NIP-49](https://github.com/nostr-protocol/nips/blob/master/49.md)はNostrプロトコルにおける秘密鍵のパスワード暗号化手法を規定した標準です。WebAuthnパスキーとNIP-49を組み合わせることで、より堅牢なセキュリティとクライアント間の互換性を両立できます。

NIP-49の仕様では次のようなプロセスが定義されています：

1. **パスワードからの鍵導出**:
   - パスワードはUnicode NFKC形式に正規化される
   - scryptアルゴリズム（パラメータ: LOG_N, r=8, p=1）で対称鍵を導出
   - LOG_Nは計算負荷を決定（16=64MiB, 18=256MiB, 20=1GiB, 22=4GiB）

2. **秘密鍵の暗号化**:
   - XChaCha20-Poly1305アルゴリズムを使用
   - 24バイトのランダムNONCE生成
   - 鍵のセキュリティ状態をメタデータとして記録（KEY_SECURITY_BYTE）
   - 暗号化データをbech32エンコードし「ncryptsec」プレフィックスを付与

WebAuthnパスキーとの統合では、ユーザーが入力するパスワードの代わりに、パスキーから得られるPRF値を使用します。具体的には：

1. WebAuthnのPRF拡張で高エントロピーなバイト列を取得
2. このPRF値をNIP-49のパスワード代わりとしてscryptに入力
3. 導出された対称鍵でNostr秘密鍵をXChaCha20-Poly1305暗号化
4. 標準の「ncryptsec」形式で保存

これにより、パスキーで保護されながらも、他のNostrクライアントとの互換性を維持できます。例えば、パスキーが利用できない環境でも、ncryptsecエンコードされた秘密鍵を別のNIP-49対応クライアントでインポートすることが可能です（その場合は元のPRF値の代わりにユーザーが設定したバックアップパスワードを用いる）。

### 署名要求時のアンラップと署名

イベントに署名する際は、再び`navigator.credentials.get()`を呼び出してPRF拡張の出力を取得します（同じsalt等を使えば同じ出力が得られる）。Web Cryptoにより以前と同じ対称鍵を導出し、保存していた暗号化された秘密鍵を復号します。

これにより、署名処理の瞬間だけNostr秘密鍵が平文で復元されます。アプリはその鍵でイベントハッシュに署名し（例えばEd25519署名）、得られた署名値をイベントオブジェクトに格納します。署名後、平文鍵は速やかにメモリから削除します（ガベージコレクタ任せでなく明示的にバッファをゼロ化するとなお良い）。

この一連の処理により、ユーザーは秘密鍵の存在を意識せず、裏で必要なときだけ復号・利用される形になります。

#### 簡略化した擬似コード例: WebAuthnパスキーとNIP-49を統合した秘密鍵ラップ

```javascript
const credId = /* 登録時に保存したCredential ID */;
const webAuthnSalt = new Uint8Array([/* 任意の固定バイト列 */]);

// WebAuthnでPRF拡張を使用し、派生キー素材を取得
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: new Uint8Array(32),  // チャレンジ（適当でOK。拡張のみ利用）
    allowCredentials: [{ id: credId, type: "public-key" }],
    userVerification: "required",
    extensions: { prf: { eval: { first: webAuthnSalt } } }
  }
});
const prfOutput = assertion.getClientExtensionResults().prf.results.first;

// NIP-49: scryptパラメータを設定
const LOG_N = 18; // 256MiBメモリ使用（環境に応じて16-22の間で調整可能）
const SALT = crypto.getRandomValues(new Uint8Array(16));

// scryptでSYMMETRIC_KEYを導出（r=8, p=1はNIP-49で固定値）
const SYMMETRIC_KEY = await scrypt(
  password=prfOutput, 
  salt=SALT, 
  log_n=LOG_N, 
  r=8, 
  p=1
);

// NIP-49: XChaCha20-Poly1305で暗号化
const KEY_SECURITY_BYTE = 0x01; // セキュアに管理された鍵
const NONCE = crypto.getRandomValues(new Uint8Array(24));
const CIPHERTEXT = await xchacha20poly1305Encrypt(
  plaintext=nostrPrivKeyBytes,
  associated_data=KEY_SECURITY_BYTE,
  nonce=NONCE,
  key=SYMMETRIC_KEY
);

// NIP-49形式でエンコード
const VERSION_NUMBER = 0x02;
const CIPHERTEXT_CONCATENATION = concat(
  VERSION_NUMBER, LOG_N, SALT, NONCE, KEY_SECURITY_BYTE, CIPHERTEXT
);
const ENCRYPTED_PRIVATE_KEY = bech32_encode('ncryptsec', CIPHERTEXT_CONCATENATION);

// IndexedDBなどに保存し、平文の秘密鍵は消去
// この際、webAuthnSaltとcredIdも保存して後で復号できるようにする
```

上記のようにしておけば、復号時も同様のプロセスで秘密鍵を得られます：WebAuthnのPRF値を取得→scryptで対称鍵を再計算→XChaCha20-Poly1305で復号化→使用後に平文鍵を消去。

**ポイント**: PRF拡張の出力は同じクレデンシャルと入力に対して常に不変なので、ユーザーごとに固定のwebAuthnSalt（例えば文字列"nostr-key-salt"をUTF-8エンコードしたもの等）を用いれば、各ユーザーの秘密鍵を決定論的に復元できます。NIP-49のSALTはこれとは別で、暗号化のたびに新しく生成されることに注意してください。

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

### キーロガー対策

WebAuthnは従来のパスワード入力と異なり、キーボード操作を介さない認証方式のため、キーロガー型のマルウェアによる認証情報の盗難リスクが低減されます。特にビデオ録画型のキーロガーでも、生体認証プロセスや物理キー操作を再現することは困難です。

一方で、アンラップしたNostr秘密鍵がメモリに展開されるタイミングでのメモリダンプ攻撃には依然として脆弱です。この対策としては、秘密鍵を利用するコードをシンプルに保ち、平文の秘密鍵がメモリ上に存在する時間を最小限にすることが重要です。

### リプレイ攻撃とチャレンジ管理

WebAuthn認証の一部としてブラウザが送信するチャレンジは、サーバ側で検証される設計になっています。しかし、今回の用途ではNostr署名のためにローカルでWebAuthnを使用するため、チャレンジの検証がありません。

これにより理論上はリプレイ攻撃のリスクがありますが、PRF拡張を用いた鍵導出には影響しません。なぜならPRF値の出力はチャレンジではなく事前に設定したsaltに依存するためです。

### ブラウザ間の差異

WebAuthn APIやその拡張機能のサポート状況はブラウザによって異なります。特にPRF拡張は比較的新しい機能であり、2024-2025年時点でも対応が限定的です。

実装では複数のフォールバック戦略を持ち、例えばPRF拡張が利用できない場合はHMAC-secret拡張を試し、それも利用できない場合はパスワードベースのフォールバックを提供するなど、段階的な対応が必要になります。

## NIP-49との互換性についてのトレードオフ

前述したNIP-49との統合にはメリットがある一方で、以下のようなトレードオフも考慮する必要があります：

### パフォーマンス面でのデメリット

- **計算負荷の増加**: NIP-49のscryptアルゴリズムは意図的に計算コストが高く設計されています。特にLOG_Nパラメータを高く設定すると（20以上）、暗号化/復号に数秒かかる場合があります。これはUXに直接影響します。
- **メモリ使用量の増加**: scryptはメモリハードな設計で、例えばLOG_N=18で256MiB、LOG_N=20で1GiBのメモリを使用します。リソースが限られたデバイスでは問題になる可能性があります。
- **処理の複雑化**: WebAuthnによるPRF値取得→scrypt計算→XChaCha20-Poly1305暗号化という多段階の処理が必要になり、シンプルなAES-GCM暗号化と比べると実装が複雑になります。
- **鍵導出の冗長性**: WebAuthnから得たPRF値はすでに高エントロピー（十分にランダム）なデータであるため、scryptによる追加の鍵導出処理は本質的に冗長です。通常scryptはユーザーが入力する低エントロピーなパスワードを強化するために使用されますが、PRF値自体がすでに暗号学的に強い値であるため、この追加処理は計算コストの増加に見合った明確なセキュリティ上の利点をもたらさない可能性があります。

### 互換性と実装の課題

- **ライブラリ依存**: XChaCha20-Poly1305やscryptのJavaScript実装は標準のWeb Crypto APIに含まれておらず、追加のライブラリが必要になります。これによりバンドルサイズが増加します。
- **対応環境の制限**: PRF拡張とXChaCha20-Poly1305の両方をサポートする環境は限られています。特にモバイルデバイスや古いブラウザでの動作確保が課題となります。
- **エラーハンドリングの複雑さ**: 複数の暗号処理ステップがあるため、エラー発生時のデバッグや回復処理が複雑になります。

### 開発とメンテナンスのコスト

- **開発リソースの増加**: NIP-49対応には追加の実装工数が必要になります。
- **テスト要件の拡大**: 複数の暗号化アルゴリズムとパラメータの組み合わせをテストする必要があります。
- **将来的な保守**: 複雑な実装は長期的なメンテナンスコストも高くなります。

## 実装アプローチの推奨

上記のトレードオフを考慮し、以下のような段階的な実装アプローチを推奨します：

1. **基本実装（最初のPoC）**: 
   - WebAuthnのPRF拡張から取得した値を直接鍵材料としてAES-GCMでNostr秘密鍵を暗号化
   - シンプルで高速、最小限のライブラリ依存で実装可能
   - ブラウザネイティブのWeb Crypto APIのみで実装可能

## PRF値を直接Nostrシークレットキーとして使用する選択肢

基本実装としては、PRF値を用いてNostr秘密鍵を暗号化する方式が安全で柔軟性が高いですが、さらにシンプルかつ効率的なアプローチとして、**PRF値を直接Nostrシークレットキーとして使用する**方法も検討できます。

### 技術的実現可能性と考慮点

WebAuthn PRF拡張から取得できる値は32バイトの固定長で、HMAC-SHA-256ベースの疑似乱数です。Nostrのシークレットキーも32バイトであり、技術的には以下の手順で直接使用が可能です：

1. パスキーを作成し、PRF拡張を有効化
2. PRF拡張を使って32バイトの値を取得（毎回同じ入力に対して同じ出力）
3. この値をそのままNostrのシークレットキーとして使用
4. secp256k1の秘密鍵として公開鍵を導出

#### メリット
- **実装の簡素化**: 暗号化/復号のレイヤーが不要
- **処理効率の向上**: 演算量が大幅に削減される
- **UXの改善**: 認証と署名が1ステップで完結
- **セキュリティモデルの明確化**: 中間層がなく理解しやすい

#### 考慮すべき点

PRF値を直接シークレットキーとして使用する場合の理論的な懸念として、その値がsecp256k1曲線の有効な秘密鍵範囲に入らない可能性があります。secp256k1の有効な秘密鍵は以下の範囲内の整数です：

- 最小値: 1
- 最大値: n-1（nは曲線の位数、約2^256に近い値）

実際には、PRF値が有効範囲外となる確率は約2^-224（10^67回に1回程度）と非常に低く、実用上はほぼ問題になりません。念のため、実装時に以下のようなバリデーションを行うことも考えられます：

```javascript
function isValidSecp256k1PrivateKey(key: Uint8Array): boolean {
  // ゼロチェック
  if (key.every(byte => byte === 0)) return false;
  
  // 上限チェック（実際にはもっと効率的な実装が必要）
  const n = new Uint8Array([
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFE,
    0xBA, 0xAE, 0xDC, 0xE6, 0xAF, 0x48, 0xA0, 0x3B,
    0xBF, 0xD2, 0x5E, 0x8C, 0xD0, 0x36, 0x41, 0x41
  ]);
  
  // バイト単位での比較
  for (let i = 0; i < 32; i++) {
    if (key[i] < n[i]) return true;
    if (key[i] > n[i]) return false;
  }
  return false; // 等しい場合も無効
}
```

### 実装方針

PRF値を直接使用する実装は実験的（PoC）な位置づけとして提供し、ユーザーが選択できるようにすることを推奨します。具体的には：

1. **実装方式の明示的な分離**:
   - 暗号化方式（PWKBlobV1）: 標準実装、既存の秘密鍵をインポート可能
   - PRF直接使用方式（PWKBlobDirect）: 実験的実装

2. **シンプルなPWKBlobDirect形式**:
   ```json
   {
     "v": 1,
     "alg": "prf-direct",
     "credentialId": "hex形式のクレデンシャルID"
   }
   ```

3. **署名処理での分岐**:
   ```typescript
   async signEvent(event, pwk, credentialId, options = {}) {
     if (pwk.alg === 'prf-direct') {
       // PRF値を直接シークレットキーとして使用
       const sk = await this.#prfSecret(credentialId);
       // ...署名処理
     } else {
       // 従来の暗号化方式
       // ...復号して署名
     }
   }
   ```

この方式では、PRF値を直接使用するシンプルな方法と、既存の秘密鍵をサポートする標準方式の両方を提供でき、ユースケースに応じた柔軟な選択が可能になります。PRF直接使用方式は特に新規ユーザーや、単一のIdentityのみを必要とするケースに適しています。

2. **オプションとしてのNIP-49対応（将来拡張）**:
   - 基本実装が安定した後に、オプション機能としてNIP-49対応を追加
   - ユーザーがクライアント間の互換性を必要とする場合に選択可能にする
   - パフォーマンスに関する警告や設定オプション（LOG_N値など）を提供
   - PRF直接使用方式と組み合わせない（異なるユースケース向け）

3. **UI/UXの最適化**:
   - NIP-49対応を選択した場合のパフォーマンス影響を最小化するUI設計
   - バックグラウンドワーカーでの処理や進捗表示の実装
   - 暗号化強度とパフォーマンスのバランスをユーザーが選択できる機能

このアプローチにより、まずは基本的なセキュリティと使いやすさを確保しながら、将来的に標準との互換性も提供することができます。特に最初のPoC実装ではNIP-49は採用せず、動作確認後にオプションとして追加することで、開発リスクを低減できます。

#### 簡略化した擬似コード例: PRF拡張とAES-GCMによるシンプルな実装

```javascript
const credId = /* 登録時に保存したCredential ID */;
const webAuthnSalt = new Uint8Array([/* 任意の固定バイト列 */]);

// WebAuthnでPRF拡張を使用し、派生キー素材を取得
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: new Uint8Array(32),  // チャレンジ（適当でOK。拡張のみ利用）
    allowCredentials: [{ id: credId, type: "public-key" }],
    userVerification: "required",
    extensions: { prf: { eval: { first: webAuthnSalt } } }
  }
});
const prfOutput = assertion.getClientExtensionResults().prf.results.first;

// PRF出力値を直接AES-GCMの鍵材料として使用（NIP-49のscryptを省略）
const aesKey = await crypto.subtle.importKey(
  "raw",
  prfOutput,  // PRF値を直接鍵として使用（32バイト/256bit）
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"]
);

// Nostr秘密鍵をAES-GCMで暗号化（シンプルで高速）
const iv = crypto.getRandomValues(new Uint8Array(12));  // AES-GCM用の初期化ベクトル
const encryptedPrivKey = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  aesKey,
  nostrPrivKeyBytes
);

// 暗号化データとIVを保存
const keyData = {
  encryptedKey: encryptedPrivKey,
  iv: iv,
  // その他のメタデータ（公開鍵情報など）
};

// IndexedDBなどに保存し、平文の秘密鍵は消去
await storeEncryptedKey(keyData);
nostrPrivKeyBytes.fill(0);  // メモリから平文鍵を明示的に消去
```

この実装では、NIP-49で必要なscryptやXChaCha20-Poly1305の追加ライブラリが不要で、ブラウザ標準のWeb Crypto APIのみで実装可能です。PRF拡張から得られる値は十分に高エントロピーであるため、セキュリティを大きく損なうことなく処理を大幅に簡素化できます。

復号時も同様に、PRF値からAES鍵を再作成し、保存していたIVと暗号化データを用いて復号するだけの単純な処理になります。これにより、特に低スペックデバイスでのパフォーマンスが向上し、ユーザー体験の改善が期待できます。

## まとめ

WebAuthnパスキーを利用したNostr秘密鍵の保護は、ユーザーエクスペリエンスとセキュリティの両方を向上させる有望なアプローチです。直接利用と間接利用（暗号化/復号）の両方の可能性があり、特に間接利用は現実的な実装オプションを提供します。

PRF拡張等の最新機能を活用し、WebAuthnの認証メカニズムとNostrの署名要件を組み合わせることで、一般ユーザーにも扱いやすい高セキュリティソリューションが実現可能です。

NIP-49との統合は標準化と互換性のメリットがある一方、パフォーマンスと実装の複雑さというトレードオフがあります。プロジェクトのフェーズに応じて段階的に実装することで、これらの課題に対処しながら、最終的には柔軟で安全な鍵管理ソリューションを提供できるでしょう。
