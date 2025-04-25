# WebAuthn PRF拡張の最新動向と対応状況（2025年4月現在）

## 調査項目

- 現時点（2025年）でPRF拡張が有効なブラウザとそのバージョン
- プラットフォームAuthenticator（Windows Hello, macOS Touch ID, Androidなど）とセキュリティキー（YubiKey, SoloKeyなど）のPRF対応状況
- WebAuthn Level 3におけるPRF拡張の標準化ステータス（W3Cでの位置づけ）
- PRF拡張を利用したコード例やデモ実装の有無
- PRF拡張に関する公式ドキュメントや仕様書

## 1. PRF拡張の標準化状況（WebAuthn Level 3仕様における位置づけ）

WebAuthnのPseudo-Random Function (PRF)拡張は、W3C Web Authentication Level 3仕様で追加された新機能の一つです。現在、このLevel 3仕様はW3C作業草案（Working Draft）の段階にあり（2025年1月27日時点の最新版が公開）、最終勧告に向けて検討と実装のフィードバックが進められています。

PRF拡張は、WebAuthn Level 1/2との後方互換性を保ちつつ導入された拡張機能で、ユーザー認証に加えて認証器に紐付いた擬似乱数関数（PRF）出力を取得することを可能にします。これは具体的には、HMACなどの秘密鍵を用いたハッシュ計算を認証器側で行い、その結果（32バイトのバイナリ）をウェブ側で利用できるようにする拡張です。

PRF拡張はクライアント拡張（client extension）および認証器拡張（authenticator extension）の一つとして定義されており、登録時（credential creation）および認証時（assertion）にリクエスト可能です。拡張の識別子は "prf" で、内部的にはFIDO2 CTAPのhmac-secret拡張を利用して実装されます。

もともとCTAP2のhmac-secretはWindows Helloのローカルデータ復号用などに設計された機能ですが、WebAuthn PRF拡張ではこれを汎用的な疑似乱数関数サービスとしてウェブから扱えるよう標準化しています。例えば、PRF拡張により各認証情報に紐付いた秘密の32バイト値を取得できるため、ウェブアプリケーションはそれをユーザーデータの暗号化鍵などに利用できます。このように認証と同時に秘密鍵マテリアルを生成・取得できるため、エンドツーエンド暗号など新たなユースケースが可能になります。

現時点（2025年4月）でW3C仕様上はPRF拡張の文言が確定しつつあり、実装も進んでいます。仕様上のステータスは**「Working Draft」**ですが、主要ブラウザでの実装状況を踏まえて今後Candidate Recommendation（勧告候補）へ進む段階と考えられます。Level 3ではPRF拡張の他にも複数の拡張（クロスオリジン認証やDevice Public Key拡張等）が追加されており、W3C WebAuthn WGは各機能の実装報告を集めつつ仕様を完成させようとしています。

公式の仕様書では、PRF拡張の詳細な定義と処理手順が示されています。クライアントJS APIからextensions.prfに入力を渡すと、ブラウザ（ユーザーエージェント）はまずその入力値にコンテキスト文字列 "WebAuthn PRF" を付加してSHA-256ハッシュを計算し、それをCTAP経由で認証器に送信します。認証器側では、そのハッシュ値を元に内部のPRF（HMAC）を計算し、結果を返します（この際、ユーザー検証要件は自動的に満たされるよう調整されます）。ブラウザは認証器から返された結果（CTAP hmac-secret拡張では暗号化されたバッファ）を復号し、getClientExtensionResults()を通じてウェブページに結果を提供します。これら一連の流れにより、ウェブアプリは認証フロー中に安全に生成された32バイト長のシークレットにアクセスできるわけです。

## 2. 各ブラウザの対応状況（Chrome, Safari, Firefox, Edge 他）

PRF拡張は現在、Chromium系ブラウザで先行実装されています。Google Chromeではバージョン116以降でデフォルト有効化され、フラグなしでPRF拡張が利用可能になりました。Chrome 116は2023年中頃に安定版がリリースされており、以降のChrome（および同じBlinkエンジンを用いるブラウザ）はPRF拡張に対応しています。Microsoft Edge（Chromiumベース）も同様で、Chromeと同タイミングでPRF拡張をサポートしました。実際、Bitwardenのブログ（2024年1月）でも「現在Chromiumベースのブラウザ（ChromeやEdge）でPRF拡張がサポートされている」ことが言及されています。したがって、最新版のChrome系ブラウザ（Opera, Braveなど含む）では概ねPRF拡張を利用できると考えてよいでしょう。

Mozilla Firefoxについては、2024年～2025年にかけて実装が完了しました。Firefoxではバージョン135でPRF拡張の機能がリリースされ、Windows環境も含め利用可能になっています。Firefox開発チームは「Baseline support」と称して段階的に実装を進め、Firefox 135（2025年初頭リリース）でデスクトップ版の拡張機能対応が整った形です。実際にFirefox 135がリリースされた際には「ついにFirefoxでもFIDO2のPRF拡張がサポートされた」とコミュニティで報告されています。したがって、Firefoxをご利用の開発者はバージョン135以上であることを前提とすれば、PRF拡張を用いたWebAuthn機能をテスト・提供できる状況です。

Safari（WebKit）については、Appleが少し遅れて対応を開始しましたが、最新のOSリリースでサポートが追加されています。SafariはiOSおよびmacOSのバージョンに依存しますが、iOS/iPadOS 18およびmacOS 14 (Sonoma) の次のリリース以降でPRF拡張に対応しました。具体的には、2024年のWWDCで公開されたSafari 18 (iOS 18, macOS 14.1相当)のベータ版でPRF拡張サポートが実装されており、Safari 18からはWebAuthn PRF拡張が有効になっています。AppleのプラットフォームではエンジンがWebKitに統一されているため、SafariだけでなくiOS上のChromeやFirefoxなど他のブラウザアプリ（内部はWebKitを使用）は、iOS 18以降であればPRF拡張を利用できます。ただしiOS 18リリース初期の18.0～18.3にはクロスデバイス認証時の不具合が報告されており、18.4で修正されるなど安定化途上の側面もあります。macOSについても、2024年リリースのmacOS 15（仮称）+ Safari 18組み合わせで正式対応となり、それ以前のSafari 17では未サポートでした。

以上をまとめると、主要ブラウザ4種では2024～2025年にかけてPRF拡張への対応が出揃った状況です。Chrome/Edgeは2023年後半～2024年前半には既に実用段階に達し、Firefoxも2025年前半に追従、Safari/WebKitも2024年後半に対応完了しています。なお、各ブラウザの対応状況はブラウザのデスクトップ版とモバイル版で差異があります。たとえばAndroid版Chrome/Edgeはデスクトップ版同様にPRF拡張をサポートしており、Androidプラットフォーム認証情報との組み合わせで機能します。一方、Android版Firefox（GeckoView）は執筆時点では未対応で、モバイル版については実装が遅れています。このように、デバイスやOSによって対応状況が異なるため、開発者はターゲットとする環境ごとの互換性に留意する必要があります。

## 3. プラットフォーム認証器およびセキュリティキーの対応状況

WebAuthn PRF拡張の利用可否は、ブラウザだけでなく認証器側の対応にも依存します。PRF拡張をフルに活用するには、以下の3層すべてが対応している必要があります：
1. 認証器（ハードウェア/プラットフォーム）
2. OS（認証APIレイヤ）
3. ブラウザ

ブラウザ実装については前述の通りですが、本項では認証器（プラットフォーム認証器・Roamingセキュリティキー）の対応状況を解説します。

### Windows Hello（プラットフォーム認証器）

現状、Windowsのプラットフォーム認証（Windows Hello）はCTAPのHMAC-secret拡張をサポートしていないため、PRF拡張に対応していません。Windows 10/11の生体認証やPINによるプラットフォームパスキーでは、HMAC-secret機能が実装されておらず、PRF要求を出しても認証器側で処理できないため**getClientExtensionResults().prf.enabledがfalseになる**などの挙動になります。実際、MicrosoftコミュニティでもWindows HelloのPRF非対応が指摘されており、将来的な対応が望まれています。したがって、Windows環境でPRF拡張を利用する場合はセキュリティキーを使う必要があります（後述）。

### macOSのTouch ID（およびiCloudキーチェーン上のパスキー）

Appleは最新OSでHMAC-secret機能を組み込んだため、macOS 15以降のTouch ID（Secure Enclave）によるプラットフォーム認証器はPRF拡張をサポートします。macOS 14（Sonoma）以前のTouch IDではPRF非対応でしたが、2024年後半リリースのmacOSでサポートが追加されました。これによりSafari 18+ではTouch IDからPRFを取得できます。Chromeなど他ブラウザからも、将来的にAppleのプラットフォーム認証APIを利用する実装（Chrome 132以降で実装済み）が有効化されれば、macOS上でTouch IDを用いたPRFが可能となる見込みです（執筆時点ではChromeはMacのプラットフォーム認証サポート実装済みだが未リリース）。

**まとめ**: 最新のmacOS環境（macOS 15 + Safari 18以降）ではプラットフォームパスキーからPRF拡張を利用可能。開発者はmacOSのバージョン要件にも注意が必要です。

### iOS/iPadOSのFace ID / Touch ID（プラットフォーム認証器）

iPhoneやiPad上のパスキー（iCloudキーチェーンに保存）は、iOS/iPadOS 18でPRF拡張に対応しました。iOS 17以前ではPRF非対応でしたが、18.0以降でWebAuthn API経由のPRF出力が可能です。これにより、モバイルSafariやWebView経由のブラウザから、デバイス内のパスキーを使って暗号鍵を取得するユースケースが現実的になりました。なお、iPhoneを他の端末の認証に使う**クロスデバイス認証（CDA/Hybrid）**のケースでも、iOS 18.4以降はPRF出力が安定して機能することが確認されています。Androidなどと異なり、iOSでは他ブラウザも内部的にWebKitエンジンを使うため、Safari同様の制約・対応状況となります。

### Androidプラットフォーム認証器（Google Play Services Passkeys）

Androidは比較的早くからCTAP hmac-secretをサポートしており、Android 対応のパスキーは概ねPRF拡張に対応しています。Googleの実装するAndroid Passkey（Googleアカウントに紐付くか、端末ローカルに保存されるFIDO2認証情報）はHMAC-secret機能を備えており、Chrome/EdgeのAndroid版でPRF拡張をリクエストすると正常に32バイトキーを取得できます。Samsung InternetなどChromium派生ブラウザでもAndroidの認証機能経由でPRFが使えることが報告されています。一方、Firefox for Android（Gecko）はブラウザ側未対応のため現時点では利用不可です。Androidの場合、OSは各ブラウザに共通のFIDO2 API（Google Play ServicesのFIDOモジュール）を提供するため、OSおよび認証器レベルでの対応は比較的統一されていると言えます。

### セキュリティキー（Roaming認証器）

YubiKeyやSoloKey、Feitian等のFIDO2セキュリティキーの多くはCTAP2のHMAC-secret拡張に対応しています。したがって、それらのキーを利用すればPRF拡張を使用可能です。例えばYubicoのSecurity KeyシリーズやYubiKey 5シリーズはHMAC-secretを実装しており、PRF拡張リクエストに対して32バイトのHMAC結果を返せます（Yubico開発者ドキュメントでもHMAC-secret拡張の使用方法が記載されています）。SoloKeys等のオープンソースFIDO2キーも同様に対応しています。

注意点として、セキュリティキーでPRFを使うにはFIDO2モードかつDiscoverable Credential（紛失対応可能な「リセット可能な」認証情報）として登録しておくことが推奨されています。Discoverable（住み込み）でない認証情報でもallowCredentialsを指定すればPRFを取得できますが、ユーザーデータ暗号化の用途ではパスキー運用（Discoverableな認証情報）が前提となるケースが多いです。実際、Bitwardenなども「パスキー（＝DiscoverableなFIDO2認証情報）を登録し、その際にPRF拡張を利用して暗号鍵を取得する」方式を採用しています。

以上を踏まえると、Windowsプラットフォーム認証器のみが現時点で未対応の例外であり、それ以外の主要な認証器（Apple・Googleのプラットフォーム、外部セキュリティキー）はHMAC-secret機能を備えていると言えます。開発者は、ユーザーの利用環境によっては**PRF拡張が利用不可となる組み合わせ（例: Windows Hello使用 + Chrome）**がある点に注意し、フォールバック手段を用意する必要があります。例えばWindowsではパスキー認証自体は可能ですがPRFは得られないため、その場合は従来通り別途ユーザーに復号用パスワードを入力させる、といった設計上の検討が必要です。一方で、Androidやセキュリティキー使用時にはスムーズにPRFが使えるため、各プラットフォームのサポート状況に応じて条件分岐やUI上の案内を行うことが望ましいでしょう。

## 4. PRF拡張のコード例・デモ実装

実際にWebAuthn PRF拡張を使うコード例として、W3Cの解説や各種ブログで紹介されているものをいくつか挙げます。基本的な使用方法は**navigator.credentials.create()またはnavigator.credentials.get()呼び出し時にpublicKeyオプション内でextensions: { prf: ... }を指定**し、処理後にcredential.getClientExtensionResults().prfから結果を取得する形になります。

### 認証（サインイン）時に固定キーを取得する例

WebAuthnクライアント拡張では、evalフィールドに任意のバイト列（BufferSource）を渡すと、その値を入力としたPRF計算結果（32バイト）が得られます。以下は特定の文字列 "Foo encryption key" を入力としてPRFを評価し、その結果をBase64表示するコード例です。

```javascript
const publicKey = {
  // ...チャレンジやRP情報、ユーザ情報など通常のオプション...
  challenge: new Uint8Array([1,2,3,4]).buffer,  // サーバからのランダムチャレンジ
  extensions: {
    prf: {
      eval: { 
        first: new TextEncoder().encode("Foo encryption key") 
      }
    }
  }
};
navigator.credentials.get({ publicKey })
  .then(cred => {
    const prfResults = cred.getClientExtensionResults().prf;
    const keyBytes = new Uint8Array(prfResults.results.first);
    console.log(btoa(String.fromCharCode(...keyBytes)));
  });
```

上記ではnavigator.credentials.get()にてPRF拡張を要求し、eval.firstに文字列をセットしています。認証器とブラウザがPRFをサポートしていれば、getClientExtensionResults().prf.results.firstに32バイトのArrayBufferが格納されます（例ではそれをBase64エンコードしてコンソール出力）。実際のアプリケーションでは、この取得したバイト列をWeb Crypto API（例えばAES-GCM鍵）に利用し、保存データの復号を行うことになります。重要なのは、この鍵は認証情報ごとに一意であり、認証操作を通じてのみ取得可能な点です。つまり第三者はユーザーの認証プロセスを経ないとこの鍵を得られず、安全性が確保されます。

### 新規パスキー登録時にPRF拡張を有効化する例

認証情報の作成（登録）時にもextensions.prfを指定可能です。ただし現状のCTAP仕様では登録時に即PRF結果を取得することはできず、認証器がPRF対応かどうか（enabled）のフラグが得られるに留まります。それでも、後続の認証でPRFを得られる認証情報であることを示す指標にはなるため、登録時にPRF拡張をリクエストする価値はあります。以下はパスキー作成時にPRF拡張をリクエストするコード例です。

```javascript
const publicKey = {
  rp: { name: "Example RP" },
  user: { 
    id: new Uint8Array(16), 
    name: "user@example.com", 
    displayName: "User Example" 
  },
  pubKeyCredParams: [{ type: "public-key", alg: -7 }],  // ES256
  authenticatorSelection: { authenticatorAttachment: "cross-platform", residentKey: "required" },
  challenge: new Uint8Array([0]).buffer,  // attestationを使わないのでダミー値
  extensions: { prf: {} }  // PRF拡張をリクエスト（入力値なし）
};
navigator.credentials.create({ publicKey })
  .then(cred => {
    console.log(cred.getClientExtensionResults().prf);
    // 期待される出力: { enabled: true/false, results: {...} }
  });
```

この例ではextensions: { prf: {} }とし、具体的なeval入力は与えていません。多くの認証器は登録段階でPRF評価を実行できないため、この場合getClientExtensionResults().prfにはenabledプロパティ（PRF機能サポートの有無）が返る想定です。例えばYubiKeyであれば{ enabled: true, results: {} }といった出力になり、逆にプラットフォーム認証器（Windows Helloなど）ではenabled: falseとなります。この情報を使って、アプリケーション側で「この認証情報は後でデータ復号に使えるか」のフラグを立てておき、もしfalseであればユーザーに別途警告やフォールバック手段を提示するといった処理が可能です。

### デモ実装・ライブラリ

WebAuthn PRF拡張の概念実証として、いくつかの公開デモやライブラリも登場しています。たとえば、Chromeの開発者が公開したWebAuthn PRF Extension デモページでは、Chrome Canary（フラグ有効化）環境で実際にPRF拡張を試し、得られたバイト列を画面表示するサンプルが紹介されました。このデモはブラウザ未対応の場合にシミュレーション動作するフォールバックも備えており、PRF拡張の挙動を確認するのに有用です。

また、WebAuthn実装ライブラリであるSimpleWebAuthnや各種サーバーサイドFIDOライブラリも、最新バージョンではPRF拡張への対応が進んでいます。たとえばSimpleWebAuthnではクライアントから送信されるauthenticationExtensionsClientOutputs.prfを解析し、得られたバイト列をそのままアプリケーションに渡せるようになっています（GitHubの議論でもSafari対応に合わせてPRF使用を検討する声があります）。

さらに、Bitwardenや1Passwordなど実際のサービスでの実装も始まっています。BitwardenはウェブボルトのパスキーログインにPRF拡張を用いており、ユーザーがパスキーで認証すると同時に暗号化されたパスワード保管庫を復号する鍵を取得する仕組みを実現しました。このように、理論段階だったPRF拡張も徐々に現実のアプリケーションで使われ始めており、そのコード例や実装知見が各種ブログで共有されています。

## 5. 公式ドキュメント・仕様へのリンクと実装時の注意点

公式リファレンスとしては、W3CのWebAuthn Level 3仕様書および関連するFIDO2 CTAP仕様が第一に挙げられます。W3C仕様書の該当セクション「10.1.4 Pseudo-random function extension (prf)」には、PRF拡張の目的やデータ構造、処理手順が詳細に記載されています。開発者はこの原文仕様に目を通すことで、ブラウザ実装間の差異やセキュリティ上の考慮事項を正しく理解できます。

例えば仕様には**「提供されたPRF入力は固定のコンテキスト文字列と連結してハッシュされてから認証器に渡される」**ことが明記されており、これによって「WebAuthn経由で取得したHMAC値が他の用途（OSログイン等）で使われるHMACと衝突しない」保証を与えています。また、CTAPレベルでは前述の通りhmac-secret拡張（FIDO2 v2.1）がベースとなっており、その仕様もFIDO Allianceの文書にて参照可能です。

### 実装上の注意点・制約

#### 互換性チェックとフォールバック

前述のように、PRF拡張は全環境で使えるわけではありません。ブラウザ・OS・認証器の三者が対応して初めて機能するため、どれか一つでも未対応なら結果は得られません（getClientExtensionResults()でundefinedまたはenabled:falseになる）。したがって実装時には、getClientExtensionResults().prfの内容を必ず確認し、期待する結果（results.firstなど）が存在しなければ従来手法による鍵取得にフォールバックする処理が必要です。例えばBitwardenでは、パスキーがPRF非対応の場合はパスキー認証自体は行いつつ暗号化解除は従来のマスターパスワードで行うという二段構えを採用しています。

#### ユーザー体験とセキュリティUI

PRF拡張を利用する際、認証フローにおけるユーザーの操作自体は通常のWebAuthnと変わりません（タッチIDやセキュリティキータッチのプロンプトは同様）が、裏で追加のデータがやり取りされます。このため、例えばWindows環境で外部セキュリティキー+PIN使用時には、HMAC-secret拡張の制約上ユーザーにPIN入力を要求する場合がある点に注意してください（認証器が内部UVなしでHMAC-secretを使用する場合、PINによるUVが必要になる）。

また、一般ユーザーには「このパスキーでデータ復号もしています」ということが認知されにくいため、パスキー削除や紛失時のリスクについて十分な説明やバックアップ手段を用意することが望ましいという指摘もあります。特にPRFで得られる鍵でデータを暗号化してしまうと、その認証情報を失った際にデータ復元不能となる恐れがあるため、複数パスキーの登録や非常用コードの発行等の対策が実用上は重要です。

#### 技術仕様上の制約

現行仕様では、1回の認証で最大2つのPRF入力を同時に評価可能です（firstとsecond）。2つの値を渡すと、results.firstとresults.secondの両方が取得できます。これによりサーバはキーのローテーションなど高度な用途にも対応できます。

例えば毎回secondに次回用の新ランダム値を入れておき、firstで現在の鍵を取得・使用しつつ、次回ログイン用の鍵をsecondから計算して準備しておく、といったパターンです。実装する際は、このような2値入力のAPI仕様や結果のマッピング（どのcredentialIdに対する結果かを示すevalByCredentialオプションなど）も考慮してください。特に複数の認証情報をallowCredentialsで指定してPRFを得る場合、evalByCredentialにCredentialIDごとの入力をマップする必要があり (Web Authentication: An API for accessing Public Key Credentials - Level 3)、フォーマットを誤るとNotSupportedErrorやSyntaxErrorがスローされるので注意が必要です (Web Authentication: An API for accessing Public Key Credentials - Level 3)。
