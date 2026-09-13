## PRF Support Tables Summary

### Platform Support Status Table (as of 2026-05)

#### PRF extension (WebAuthn Level 3) Support Status for Major Platforms

| Category | Platform/Browser | Minimum Version (Stable) | Default Status | Notes |
|----------|------------------|--------------------------|----------------|-------|
| **Browser** | Chromium-based<br>(Chrome, Edge, Opera, Brave...) | 116 and later | ON | PRF with security keys / Google Password Manager since 116. PRF via iCloud Keychain on macOS since Chrome 132; PRF-on-create with Windows Hello since Chrome 147 |
| | Safari 18<br>(macOS 15 / iOS 18 / iPadOS 18) | 18.0 | ON | Announced at WWDC 24. Works with iCloud Passkey (platform authenticator). PRF extension data is not passed to external CTAP2 security keys. **Returns `prf.results` from `create()`**, confirmed on a physical iPhone (2026-09; see "PRF on create and user gesture" below) |
| | Firefox | 135 and later | ON | Enabled by default (no flag) since Firefox 135 (2025-02-04). Creation-time PRF backported in 147; full create/authentication support with Windows Hello in 148+. Firefox for Android is not supported |
| **Platform<br>Authenticator** | Google Password Manager Passkey<br>(Android 14+ / Chrome 116+) | 116 | ON | PRF available in Chromium, hybrid path also supported |
| | Apple Passkeys<br>(Touch ID / Face ID on macOS 15・iOS 18 and later) | 18 / 15 | ON | PRF support added along with automatic passkey upgrade |
| | Windows Hello<br>(Windows 11) | — | Supported (conditional) | Windows' WebAuthn platform API (`WEBAUTHN_API_VERSION_8`) supports PRF (hmac-secret) evaluation. Requires a recent Windows 11 build combined with a PRF-capable browser (Chrome 147+ / Firefox 148+, etc.). The exact Windows build where support begins is not officially documented — verify on actual hardware |
| | External FIDO2 Security Key<br>(YubiKey 5, Feitian, Solo v2...) | FW 5.2+ | ON | PRF uses CTAP2 hmac-secret extension. Major keys already implemented |
| **Standard Specification** | WebAuthn L3 #prf-extension | — | — | Specification definition & IDL (Web Authentication: An API for accessing Public Key Credentials - Level 3) |

#### Reading Guide & Supplementary Notes

- **ON**: Effective without user changing flags or policies.
- **Supported (conditional)**: Available once additional requirements are met, such as a supported OS version or browser.
- Chromium-based browsers share the same Blink implementation, so Chrome=Edge=Opera behave almost identically.
- For PRF to function, **the browser, OS, and authenticator must all implement it**. For example, with Windows Hello, even if the OS is on a supported build, PRF is not generated at creation time on Chrome/Edge 146 or earlier.

#### PRF on create and user gesture

"Supports PRF" and "**returns PRF output from `create()`**" are two different things. In WebAuthn L3, whether the `prf` result of `create()` includes `results` is implementation-defined, and returning only `enabled: true` is permitted.

This affects application code. Where `create()` returns no `results`, obtaining the PRF requires a follow-up `navigator.credentials.get()` — but that get() is issued after the `create()` await resolves, i.e. **after the user gesture (transient activation) has expired**. An implementation that strictly requires a gesture would fail there with `NotAllowedError`, leaving **a passkey created but no key info stored**.

| Behavior | Chromium-based | WebKit (Safari / iOS) |
|----------|----------------|-----------------------|
| `prf.results` from `create()` | Returned | **Returned** (confirmed on a physical iPhone, 2026-09) |
| User actions needed from registration to key derivation | 1 tap | 1 tap (a single Face ID prompt) |

**On-device verification (2026-09)**: registering on iOS Safari (svelte-app standalone, no iframe) prompts for Face ID exactly **once** and runs through passkey creation, key creation and sign-in. That means `create()` does return `prf.results` and the `getPrfSecret()` fallback never happens.

The hypothesis that "WebKit returns no PRF on create, so a second `get()` is needed and fails because the gesture has expired" is therefore **disproven for iOS Safari**. The reported "registered on iOS but cannot sign in" symptom has another cause; storage partitioning of the embedded iframe (partitioned localStorage) is the leading candidate — see the corresponding item in `docs/todo.md`.

Implementations that return no PRF from `create()` do still exist (Chrome/Edge 146 and earlier with Windows Hello, Firefox 146 and earlier). Those show an authentication dialog even for a gesture-expired `get()`, so they finish in one tap — but issuing the post-registration `get()` directly from a user action remains the safer pattern should gesture requirements tighten.

#### Official Documentation

- [WebAuthn Level 3 Specification § PRF Extension (W3C Candidate Recommendation)](https://www.w3.org/TR/webauthn-3/#prf-extension)
- [Explainer (Design explanation & code examples)](https://github.com/w3c/webauthn/wiki/Explainer:-PRF-extension)

#### Key Points

- Most reliable in production environments:
  - Chromium 116+ + Google Password Manager Passkey
  - Or a Chromium-based browser + CTAP2 security key (Safari is excluded, as it does not support PRF with external security keys)

- Apple Passkeys can generate PRF on the platform side, so users don't need to be aware of the key's existence.
- Windows Hello can now be used for PRF in combination with a PRF-capable browser (Chrome 147+ / Firefox 148+, etc.), since Windows' WebAuthn platform API (`WEBAUTHN_API_VERSION_8`) added PRF (hmac-secret) evaluation. The exact Windows build where support begins is not officially documented (community reports point to an early-2026 cumulative update), so verification on actual hardware is recommended. For older environments that do not meet the requirements, workarounds such as external keys or Google Password Manager remain valid.
- Firefox has supported the PRF extension by default since version 135 (2025-02-04); no flag configuration is needed.

With this, you can see at a glance "which combinations PRF works with" when adopting the wrap/unwrap method.

### Password Manager Companies' Support Status (as of 2026-05)

| Service | Passkey Feature | PRF extension Support | Status/Notes |
|---------|----------------|----------------------|--------------|
| **Bitwarden** | Yes<br>(Web/Mobile) | Yes<br>(Official implementation) | Uses PRF to derive encryption key when unlocking Vault with Passkey. Works with Chromium-based browsers |
| **1Password** | Yes | Yes<br>(Official implementation) | PRF support officially released and rolled out across desktop, Android, and iOS platforms |
| **Dashlane** | Yes | Yes | Adopted WebAuthn PRF, deriving the vault decryption key from passkey authentication |
| **LastPass** | Yes | No<br>(Not announced) | Supports saving and using Passkeys. No official announcement of PRF adoption as of 2026-05 |

#### Summary

- PRF extension is adopted by Bitwarden, 1Password, and Dashlane (all with official implementations).
- LastPass uses conventional Vault encryption + Passkey login and does not use PRF as of 2026-05.
- When implementing a wrap/unwrap method for Nostr keys, PRF can be used in Bitwarden, 1Password, and Dashlane environments, making them suitable targets for proof testing.
