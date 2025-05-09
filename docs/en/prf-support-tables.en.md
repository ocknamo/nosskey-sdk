## PRF Support Tables Summary

### Platform Support Status Table (as of 2025-04-25)

#### PRF extension (WebAuthn Level 3) Support Status for Major Platforms

| Category | Platform/Browser | Minimum Version (Stable) | Default Status | Notes |
|----------|------------------|--------------------------|----------------|-------|
| **Browser** | Chromium-based<br>(Chrome, Edge, Opera, Brave...) | 116 and later | ON | "Chromium has supported PRF for some time"—Explicitly stated in Blink Dev (Intent to Ship: WebAuthn PRF extension) |
| | Safari 18<br>(macOS 15 / iOS 18 / iPadOS 18) | 18.0 | ON | Announced at WWDC 24. Works with iCloud Passkey, partial support for cross-device flow in 18.2 |
| | Firefox 135+ | | OFF (experimental) | Can be enabled via about:config with security.webauthn.enable_prf. Official release is in "under consideration" status |
| **Platform<br>Authenticator** | Google Password Manager Passkey<br>(Android 14+ / Chrome 116+) | 116 | ON | PRF available in Chromium, hybrid path also supported |
| | Apple Passkeys<br>(Touch ID / Face ID on macOS 15・iOS 18 and later) | 18 / 15 | ON | PRF support added along with automatic passkey upgrade |
| | Windows Hello<br>(Windows 11 23H2 current) | — | Not supported | Requests ongoing in official community |
| | External FIDO2 Security Key<br>(YubiKey 5, Feitian, Solo v2...) | FW 5.2+ | ON | PRF uses CTAP2 hmac-secret extension. Major keys already implemented |
| **Standard Specification** | WebAuthn L3 #prf-extension | — | — | Specification definition & IDL (Web Authentication: An API for accessing Public Key Credentials - Level 3) |

#### Reading Guide & Supplementary Notes

- **ON**: Effective without user changing flags or policies.
- **OFF (experimental)**: Disabled by default. Available with flags or Nightly/Beta builds.
- Chromium-based browsers share the same Blink implementation, so Chrome=Edge=Opera behave almost identically.
- For PRF to function, **both the browser and authenticator must implement it**. For example, even with Chrome 116, it will not be generated when using Windows Hello.

#### Official Documentation

- WebAuthn Level 3 Specification § PRF Extension (W3C Editor's Draft)
- Explainer (Design explanation & code examples)

#### Key Points

- Most reliable in production environments:
  - Chromium 116+ + Google Password Manager Passkey
  - Or Chromium 116+/Safari 18 + CTAP2 security key

- Apple Passkeys can generate PRF on the platform side, so users don't need to be aware of the key's existence.
- Windows Hello cannot generate PRF as of 2025-04, so Windows users need workarounds such as using external keys or Google Password Manager.
- Firefox is progressing toward L3 specification compliance, but enabling by default in the official version is still pending. If you want to experiment, set security.webauthn.enable_prf in Nightly/Beta.

With this, you can see at a glance "which combinations PRF works with" when adopting the wrap/unwrap method.

### Password Manager Companies' Support Status (as of 2025-04-25)

| Service | Passkey Feature | PRF extension Support | Status/Notes |
|---------|----------------|----------------------|--------------|
| **Bitwarden** | Yes<br>(Web/Mobile) | Yes<br>(Official implementation) | Uses PRF to derive encryption key when unlocking Vault with Passkey. Works with Chromium-based browsers |
| **1Password** | Yes<br>(β version) | Yes<br>(β version) | Announced PRF support in official blog published in 2024-07. Testing with browser extension 2.26.1+Android 8.10.38 and later |
| **Dashlane** | Yes | No<br>(Not supported) | Announced "Advanced Security" feature in 2025-04. Keys are managed in cloud Enclave without using PRF |
| **LastPass** | Yes<br>(β version) | No<br>(Not announced) | Started saving and using Passkeys from desktop Chrome in the β release of 2024-12. No mention of PRF at this time |

#### Summary

- Bitwarden and 1Password (the latter in beta stage) are actively adopting the PRF extension.
- Dashlane uses a confidential computing-type cloud Enclave, and LastPass uses conventional Vault encryption + Passkey login, neither of which uses PRF.
- When implementing a wrap/unwrap method for Nostr keys, PRF can be used in Bitwarden and 1Password environments, making them suitable targets for proof testing.
