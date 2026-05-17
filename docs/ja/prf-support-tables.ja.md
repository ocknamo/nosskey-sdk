
## PRF対応表まとめ

### プラットフォームの対応状況表（2026-05 時点）

#### PRF extension（WebAuthn Level 3）の主要プラットフォーム対応状況

| 区分 | プラットフォーム／ブラウザ | 最低バージョン (Stable) | デフォルト状態 | 備考 |
|------|--------------------------|----------------------|--------------|------|
| **ブラウザ** | Chromium 系<br>(Chrome, Edge, Opera, Brave…) | 116 以降 | ON | セキュリティキー／Google Password Manager との PRF は 116 以降。macOS の iCloud キーチェーン PRF は Chrome 132 以降、Windows Hello の登録時 PRF は Chrome 147 以降 |
| | Safari 18<br>(macOS 15 / iOS 18 / iPadOS 18) | 18.0 | ON | WWDC 24 で発表。iCloud Passkey（プラットフォーム認証器）では動作。外付け CTAP2 セキュリティキーへの PRF 拡張データ受け渡しは未対応 |
| | Firefox | 135 以降 | ON | Firefox 135（2025-02-04）でデフォルト有効化（フラグ不要）。147 で登録時 PRF をバックポート、148+ で Windows Hello との登録・認証の両対応。Android 版 Firefox は未対応 |
| **プラットフォーム<br>オーセンティケータ** | Google Password Manager Passkey<br>(Android 14+ / Chrome 116+) | 116 | ON | Chromium で PRF が利用可能、ハイブリッド経路も対応 |
| | Apple Passkeys<br>(Touch ID / Face ID on macOS 15・iOS 18 以降) | 18 / 15 | ON | 自動パスキーアップグレードと同時に PRF サポート |
| | Windows Hello<br>(Windows 11) | — | 対応（条件付き） | Windows の WebAuthn プラットフォーム API（`WEBAUTHN_API_VERSION_8`）が PRF（hmac-secret）評価に対応。利用には対応版の Windows 11 と PRF 対応ブラウザ（Chrome 147+ / Firefox 148+ 等）の組み合わせが必要。対応開始の Windows ビルドは公式に明文化されておらず、実機での確認を推奨 |
| | 外付け FIDO2 Security Key<br>(YubiKey 5, Feitian, Solo v2…) | FW 5.2+ | ON | PRF は CTAP2 hmac-secret 拡張を利用。主要キーは既に実装 |
| **標準仕様** | WebAuthn L3 #prf-extension | — | — | 仕様定義・IDL (Web Authentication: An API for accessing Public Key Credentials - Level 3) |

#### 読み方・補足

- **ON**：ユーザーがフラグやポリシーを変更しなくても有効。
- **対応（条件付き）**：OS の対応バージョンや対応ブラウザなど、追加の要件を満たせば利用可。
- Chromium 系ブラウザは同じ Blink 実装を共有するため、Chrome=Edge=Opera でほぼ同じ挙動。
- PRF が機能するには **ブラウザ + OS + オーセンティケータのすべてが実装している必要**があります。たとえば Windows Hello では、OS 側が対応ビルドであっても Chrome/Edge 146 以前のブラウザでは登録時に PRF が生成されません。

#### 公式ドキュメント

- WebAuthn Level 3 Specification § PRF Extension （W3C Candidate Recommendation）
- Explainer（設計解説 & コード例）

#### 要点整理

- 実働環境で最も確実なのは：
  - Chromium 116+ ＋ Google Password Manager Passkey
  - もしくは Chromium 系ブラウザ ＋ CTAP2 セキュリティキー（Safari は外付けセキュリティキーでの PRF が未対応のため対象外）

- Apple Passkeys はプラットフォーム側で PRF を生成できるため、利用者が鍵の存在を意識する必要がありません。
- Windows Hello は、Windows の WebAuthn プラットフォーム API（`WEBAUTHN_API_VERSION_8`）が PRF（hmac-secret）評価に対応したことで、PRF 対応ブラウザ（Chrome 147+／Firefox 148+ 等）と組み合わせて PRF を利用できるようになりました。対応開始の正確な Windows ビルドは公式に明文化されておらず（コミュニティ報告では 2026 年初頭の累積更新とされる）、実機での動作確認を推奨します。要件を満たさない旧環境向けには、外付けキーや Google Password Manager を併用する回避策が引き続き有効です。
- Firefox は 135（2025-02-04）以降、PRF 拡張をデフォルト有効でサポートしています（フラグ設定は不要）。

これで、ラップ／アンラップ方式を採用する際に「どの組み合わせで PRF が動くか」が一目で確認できます。

### パスワードマネージャ各社の対応状況（2026-05 現在）

| サービス | Passkey機能 | PRF extension対応 | 状態・メモ |
|---------|------------|-----------------|-----------|
| **Bitwarden** | あり<br>（Web／モバイル） | あり<br>（正式実装） | Passkey で Vault を解錠する際に PRF を用いて暗号鍵を導出。Chromium 系ブラウザで動作 |
| **1Password** | あり | あり<br>（正式実装） | PRF 対応を正式リリースし、デスクトップ／Android／iOS の各プラットフォームへ展開済み |
| **Dashlane** | あり | あり | WebAuthn PRF を採用し、パスキー認証から vault 復号鍵を導出する方式へ移行 |
| **LastPass** | あり | なし<br>（未発表） | Passkey の保存・利用には対応。2026-05 時点で PRF 採用の公式発表はなし |

#### まとめ

- PRF 拡張を採用しているのは Bitwarden・1Password・Dashlane の 3 社（いずれも正式実装）。
- LastPass は従来型 Vault 暗号化＋Passkey ログインを採用しており、2026-05 時点で PRF は利用していません。
- Nostr 鍵のラップ/アンラップ方式を実装する場合、Bitwarden・1Password・Dashlane の環境であれば PRF が使えるため、実証テストの対象として適しています。
