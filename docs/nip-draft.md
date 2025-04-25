NIP-XX  
Passkey-Wrapped Keys (PWK)
==========================

`draft` `optional`

This NIP specifies a **Passkey-Wrapped Key** mechanism that lets Nostr
clients store the user’s secret key encrypted (“wrapped”) with a key
derived *inside* a WebAuthn/FIDO2 **passkey** using the PRF extension.
A successful biometric / PIN gesture unlocks the secret key without the
user ever seeing or copying it.

---

## 1 Motivation

* `nsec` をコピー&ペーストする運用は  
  XSS・キーロガー・クリップボード盗み見に弱い。  
* 既存ブラウザ拡張はローカルストレージや RAM に平文を保持する。  
* WebAuthn **PRF extension** (Chrome 116+, Safari 18+, Android 14+)  
  はユーザー検証付きで 32 byte の秘密を返し、  
  それを HKDF→AES-GCM 鍵として利用できる。  
* ラップ／アンラップ方式により  
  **「生体認証 → 投稿」** の 2 ステップ UX が実現する。

---

## 2 Terminology

| Term | Meaning |
|------|---------|
| **PRF secret** | 32 byte value from `extensions.prf` |
| **PWK blob**   | JSON object holding the wrapped secret key |
| **PWK tag**    | Capability flag `"pwk"` returned by the client |

---

## 3 PWK Blob Format

```jsonc
{
  "v": 1,                   // format version
  "alg": "aes-gcm-256",
  "salt": "<16B-hex>",      // HKDF salt
  "iv":   "<12B-hex>",      // AES-GCM IV
  "ct":   "<ciphertext-hex>", // encrypted 32 B `nsec`
  "tag":  "<16B-hex>"       // AES-GCM auth-tag
}
Derived key = HKDF-SHA256(prfSecret, salt, info="nostr-pwk").

