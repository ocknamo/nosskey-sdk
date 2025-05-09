
## PRF対応表まとめ

### プラットフォームの対応状況表（2025-04-25 時点）

#### PRF extension（WebAuthn Level 3）の主要プラットフォーム対応状況

| 区分 | プラットフォーム／ブラウザ | 最低バージョン (Stable) | デフォルト状態 | 備考 |
|------|--------------------------|----------------------|--------------|------|
| **ブラウザ** | Chromium 系<br>(Chrome, Edge, Opera, Brave…) | 116 以降 | ON | 「Chromium はしばらく前から PRF をサポート」—Blink Dev で明言 (Intent to Ship: WebAuthn PRF extension) |
| | Safari 18<br>(macOS 15 / iOS 18 / iPadOS 18) | 18.0 | ON | WWDC 24 で発表。iCloud Passkey では動作、18.2 で cross-device フローに部分対応 |
| | Firefox 135+ | | OFF（試験的） | about:config で security.webauthn.enable_prf を有効化可。正式リリースは「検討中」状態 |
| **プラットフォーム<br>オーセンティケータ** | Google Password Manager Passkey<br>(Android 14+ / Chrome 116+) | 116 | ON | Chromium で PRF が利用可能、ハイブリッド経路も対応 |
| | Apple Passkeys<br>(Touch ID / Face ID on macOS 15・iOS 18 以降) | 18 / 15 | ON | 自動パスキーアップグレードと同時に PRF サポート |
| | Windows Hello<br>(Windows 11 23H2 現行) | — | 未対応 | 公式コミュニティで要望継続中 |
| | 外付け FIDO2 Security Key<br>(YubiKey 5, Feitian, Solo v2…) | FW 5.2+ | ON | PRF は CTAP2 hmac-secret 拡張を利用。主要キーは既に実装 |
| **標準仕様** | WebAuthn L3 #prf-extension | — | — | 仕様定義・IDL (Web Authentication: An API for accessing Public Key Credentials - Level 3) |

#### 読み方・補足

- **ON**：ユーザーがフラグやポリシーを変更しなくても有効。
- **OFF（試験的）**：デフォルト無効。フラグや Nightly／Beta ビルドで利用可。
- Chromium 系ブラウザは同じ Blink 実装を共有するため、Chrome=Edge=Opera でほぼ同じ挙動。
- PRF が機能するには **ブラウザ + オーセンティケータの双方が実装している必要**があります。たとえば Chrome 116 であっても Windows Hello を使う場合は生成されません。

#### 公式ドキュメント

- WebAuthn Level 3 Specification § PRF Extension （W3C Editor's Draft）
- Explainer（設計解説 & コード例）

#### 要点整理

- 実働環境で最も確実なのは：
  - Chromium 116+ ＋ Google Password Manager Passkey
  - もしくは Chromium 116+／Safari 18＋ CTAP2 セキュリティキー

- Apple Passkeys はプラットフォーム側で PRF を生成できるため、利用者が鍵の存在を意識する必要がありません。
- Windows Hello は 2025-04 時点で PRF を生成できないため、Windows ユーザーに対しては外付けキーや Google Password Manager を併用する回避策が必要です。
- Firefox は L3 仕様への追従を進めていますが、正式版へのデフォルト有効化はまだ。実験したい場合は Nightly／Beta で security.webauthn.enable_prf を設定してください。

これで、ラップ／アンラップ方式を採用する際に「どの組み合わせで PRF が動くか」が一目で確認できます。

### パスワードマネージャ各社の対応状況（2025-04-25 現在）

| サービス | Passkey機能 | PRF extension対応 | 状態・メモ |
|---------|------------|-----------------|-----------|
| **Bitwarden** | あり<br>（Web／モバイル） | あり<br>（正式実装） | Passkey で Vault を解錠する際に PRF を用いて暗号鍵を導出。Chromium 系ブラウザで動作 |
| **1Password** | あり<br>（β版） | あり<br>（β版） | 2024-07 公開の公式ブログで PRF 対応を発表。ブラウザ拡張 2.26.1＋Android 8.10.38 以降でテスト中 |
| **Dashlane** | あり | なし<br>（未対応） | 2025-04 に「Advanced Security」機能を発表。鍵はクラウド Enclave で管理し PRF は使わない方式 |
| **LastPass** | あり<br>（β版） | なし<br>（未発表） | 2024-12 のβリリースでデスクトップ Chrome から Passkey 保存・利用を開始。現時点で PRF への言及なし |

#### まとめ

- PRF 拡張を積極採用しているのは Bitwarden と 1Password（後者は β段階）。
- Dashlane は 機密コンピューティング型のクラウド Enclave、LastPass は 従来型 Vault 暗号化＋Passkey ログイン を取っており、どちらも PRF は利用していません。
- Nostr 鍵のラップ/アンラップ方式を実装する場合、Bitwarden と 1Password の環境であれば PRF が使えるため、実証テストの対象として適しています。
