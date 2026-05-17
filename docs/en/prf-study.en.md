# Latest Trends and Support Status of WebAuthn PRF Extension (as of May 2026)

## Research Items

- Browsers and their versions that currently (2026) support the PRF extension
- PRF support status for platform authenticators (Windows Hello, macOS Touch ID, Android, etc.) and security keys (YubiKey, SoloKey, etc.)
- Standardization status of the PRF extension in WebAuthn Level 3 (position within W3C)
- Availability of code examples or demo implementations using the PRF extension
- Official documentation and specifications related to the PRF extension

## 1. Standardization Status of the PRF Extension (Position in WebAuthn Level 3 Specification)

The Pseudo-Random Function (PRF) extension for WebAuthn is one of the new features added in the W3C Web Authentication Level 3 specification. A Candidate Recommendation snapshot of this Level 3 specification was published by the W3C on January 13, 2026, and it is now in the implementation-feedback stage toward final Recommendation (advancement to Recommendation is expected no earlier than February 2026).

The PRF extension was introduced while maintaining backward compatibility with WebAuthn Level 1/2, enabling the acquisition of pseudo-random function (PRF) output tied to the authenticator in addition to user authentication. Specifically, this extension allows hash calculations using secret keys such as HMAC to be performed on the authenticator side, making the results (32-byte binary) available for use on the web side.

The PRF extension is defined as one of the client extensions and authenticator extensions, and can be requested during registration (credential creation) and authentication (assertion). The extension identifier is "prf", and internally it is implemented using the hmac-secret extension of FIDO2 CTAP.

Originally, CTAP2's hmac-secret was designed for functions such as local data decryption in Windows Hello, but the WebAuthn PRF extension standardizes it to be handled from the web as a general-purpose pseudo-random function service. For example, the PRF extension allows acquiring a secret 32-byte value tied to each credential, which web applications can use for encrypting user data. By enabling the generation and acquisition of secret key material simultaneously with authentication, new use cases such as end-to-end encryption become possible.

Currently (May 2026), the wording of the PRF extension in the W3C specification is largely finalized, and implementations across major browsers are now in place. The status in the specification is **"Candidate Recommendation"**, and the W3C WebAuthn WG is trying to complete the specification toward final Recommendation while collecting implementation reports for each feature. In addition to the PRF extension, Level 3 adds multiple extensions (such as cross-origin authentication and Device Public Key extension).

The official specification shows detailed definitions and processing procedures for the PRF extension. When input is passed to extensions.prf from the client JS API, the browser (user agent) first calculates a SHA-256 hash by adding the context string "WebAuthn PRF" to the input value, and sends it to the authenticator via CTAP. On the authenticator side, it calculates the internal PRF (HMAC) based on that hash value and returns the result (in this case, the user verification requirements are automatically adjusted to be satisfied). The browser decrypts the result returned from the authenticator (encrypted buffer in the CTAP hmac-secret extension) and provides the result to the web page through getClientExtensionResults(). Through this series of processes, web applications can access a 32-byte length secret securely generated during the authentication flow.

## 2. Support Status for Each Browser (Chrome, Safari, Firefox, Edge, etc.)

The PRF extension is currently being implemented ahead of schedule in Chromium-based browsers. In Google Chrome, it has been enabled by default since version 116, allowing the PRF extension to be used without flags. The stable version of Chrome 116 was released in mid-2023, and subsequent versions of Chrome (and browsers using the same Blink engine) support the PRF extension. Microsoft Edge (Chromium-based) similarly supports the PRF extension at the same timing as Chrome. In fact, Bitwarden's blog (January 2024) also mentions that "PRF extension is currently supported in Chromium-based browsers (Chrome and Edge)". Therefore, it can be generally assumed that the PRF extension can be used in the latest versions of Chrome-based browsers (including Opera, Brave, etc.).

For Mozilla Firefox, implementation was completed during 2024-2025. The PRF extension is supported by default (no flag required) since Firefox version 135 (released February 4, 2025), making it available in Windows environments as well. The Firefox development team implemented it gradually, calling it "Baseline support". Subsequently, creation-time PRF evaluation was backported in Firefox 147, and since Firefox 148 PRF is fully supported for both the creation and authentication flows in combination with Windows Hello. Therefore, developers using Firefox can test and provide WebAuthn features using the PRF extension, assuming they have version 135 or higher (148 or higher when combined with Windows Hello).

For Safari (WebKit), Apple started supporting it a bit later, but it supports the PRF extension since iOS/iPadOS 18 and macOS 15 (Sequoia). Specifically, PRF extension support was implemented in the beta version of Safari 18 announced at WWDC 2024, and the WebAuthn PRF extension has been enabled from Safari 18. Since the engine is unified to WebKit on Apple's platforms, not only Safari but also other browser apps on iOS such as Chrome and Firefox (internally using WebKit) can use the PRF extension if they are on iOS 18 or later. However, issues with cross-device authentication were reported in the early releases of iOS 18 (18.0-18.3) and were fixed in 18.4. For macOS as well, it officially supports the combination of macOS 15 (Sequoia) + Safari 18 released in 2024, and Safari 17 prior to that does not support it. Note that Apple's PRF implementation is limited to platform authenticators (passkeys in the iCloud Keychain); a constraint remains where PRF extension data cannot be passed to external CTAP2 security keys.

To summarize, support for the PRF extension has been completed across the four major browsers during 2024-2025. Chrome/Edge had already reached practical stages in late 2023 to early 2024, Firefox followed in early 2025, and Safari/WebKit completed support in late 2024. Note that there are differences in support status between desktop and mobile versions of each browser. For example, Android versions of Chrome/Edge support the PRF extension like their desktop counterparts, functioning in combination with Android platform credentials. On the other hand, Firefox for Android (GeckoView) is not yet supported at the time of writing, and implementation for mobile versions is delayed. Thus, since the support status varies depending on the device and OS, developers need to be mindful of compatibility for each target environment.

## 3. Support Status for Platform Authenticators and Security Keys

The availability of the WebAuthn PRF extension depends not only on the browser but also on authenticator support. To fully utilize the PRF extension, all three layers must support it:
1. Authenticator (hardware/platform)
2. OS (authentication API layer)
3. Browser

Browser implementation is as mentioned above, but this section explains the support status of authenticators (platform authenticators and roaming security keys).

### Windows Hello (Platform Authenticator)

For a long time, Windows platform authentication (Windows Hello) did not support the PRF extension because it did not support the HMAC-secret extension of CTAP, but this situation has changed in recent Windows releases. Windows' WebAuthn platform API supports the PRF extension as of `WEBAUTHN_API_VERSION_8`, exposing PRF evaluation for both the registration (credential creation) and authentication (assertion) phases — for example, converting registration-time eval values into hmac-secret values (verifiable in Microsoft's `webauthn.h`, e.g. `WEBAUTHN_AUTHENTICATOR_MAKE_CREDENTIAL_OPTIONS_VERSION_8`). However, exactly which Windows build/update first enabled Windows Hello's PRF support is not officially documented by Microsoft (community reports point to an early-2026 cumulative update), so the precise requirements should be verified on actual hardware.

However, using PRF with Windows Hello requires a supported Windows 11 build as well as browser-side support. Chrome's behavior of surfacing PRF from Windows Hello varies by version: PRF-on-create is enabled by default since Chrome 147 (Chrome/Edge 146 and earlier do not yet surface PRF at creation time). Firefox backported creation-time support in Firefox 147 and fully supports both creation and authentication since Firefox 148.

Therefore, the PRF extension can now be used in Windows environments by combining a supported OS build with a supported browser. On the other hand, in older environments where the OS or browser does not meet the requirements, PRF still cannot be obtained, so fallbacks such as using an external security key remain valid.

### macOS Touch ID (and Passkeys on iCloud Keychain)

Apple has incorporated the HMAC-secret function in the latest OS, so platform authenticators using Touch ID (Secure Enclave) on macOS 15 (Sequoia) and later support the PRF extension. Touch ID on macOS 14 (Sonoma) and earlier did not support PRF, but support was added in macOS 15 released in late 2024. This allows Safari 18+ to obtain PRF from Touch ID. For other browsers like Chrome, PRF using Apple's platform passkeys (iCloud Keychain) is also possible, and PRF via the iCloud Keychain on macOS is supported since Chrome 132.

**Summary**: The PRF extension can be used from platform passkeys in the latest macOS environment (macOS 15 + Safari 18 and later). Developers also need to be aware of macOS version requirements.

### iOS/iPadOS Face ID / Touch ID (Platform Authenticator)

Passkeys on iPhone and iPad (stored in iCloud Keychain) support the PRF extension with iOS/iPadOS 18. PRF was not supported in iOS 17 and earlier, but PRF output is possible via the WebAuthn API in 18.0 and later. This makes use cases for obtaining encryption keys using device-internal passkeys from mobile Safari or browsers via WebView realistic. For **cross-device authentication (CDA/Hybrid)** cases where an iPhone is used for authentication on another device, it has been confirmed that PRF output works stably in iOS 18.4 and later. Unlike Android, since other browsers on iOS also internally use the WebKit engine, they have the same constraints and support status as Safari.

### Android Platform Authenticator (Google Play Services Passkeys)

Android has supported CTAP hmac-secret relatively early, and Android-compatible passkeys generally support the PRF extension. Android Passkeys implemented by Google (FIDO2 credentials tied to a Google account or stored locally on the device) have the HMAC-secret function, and when requesting the PRF extension in the Android versions of Chrome/Edge, you can successfully obtain a 32-byte key. It has been reported that PRF can also be used via Android's authentication features in Chromium-derived browsers such as Samsung Internet. On the other hand, Firefox for Android (Gecko) is currently unavailable due to lack of browser support. In the case of Android, since the OS provides a common FIDO2 API (FIDO module of Google Play Services) to each browser, it can be said that support at the OS and authenticator levels is relatively unified.

### Security Keys (Roaming Authenticators)

Many FIDO2 security keys such as YubiKey, SoloKey, and Feitian support the HMAC-secret extension of CTAP2. Therefore, the PRF extension can be used with those keys. For example, Yubico's Security Key series and YubiKey 5 series implement HMAC-secret and can return a 32-byte HMAC result in response to a PRF extension request (the usage of the HMAC-secret extension is also described in Yubico developer documentation). Open-source FIDO2 keys such as SoloKeys also support it similarly.

As a note, it is recommended to register security keys in FIDO2 mode as Discoverable Credentials (resettable credentials that can handle loss) to use PRF. Even with non-Discoverable credentials, PRF can be obtained by specifying allowCredentials, but many cases of user data encryption assume passkey operation (Discoverable credentials). In fact, Bitwarden and others also adopt the method of "registering a passkey (= Discoverable FIDO2 credential) and obtaining an encryption key using the PRF extension at that time".

Based on the above, as of 2026 the major authenticators (Apple and Google platforms, external security keys, and Windows Hello, for which OS-level support has been added in recent Windows releases) all have the HMAC-secret function. However, using it with Windows Hello requires both a supported OS build and a supported browser (Chrome 147+ / Firefox 148+, etc.), and developers should be aware that PRF cannot be obtained in combinations that do not meet the requirements (e.g., Windows Hello + Chrome/Edge 146 or earlier). Developers should prepare fallback means given that there are combinations where the PRF extension is unavailable depending on the user's environment. In such cases, design considerations such as having users enter a decryption password separately as before are necessary. Since PRF can be smoothly used with Android or security keys, it is desirable to handle conditional branching and UI guidance according to the support status of each platform.

## 4. Code Examples and Demo Implementations for the PRF Extension

Here are some code examples introduced in W3C explanations and various blogs as actual examples of using the WebAuthn PRF extension. The basic usage is to **specify extensions: { prf: ... } within the publicKey option when calling navigator.credentials.create() or navigator.credentials.get()**, and then retrieve the results from credential.getClientExtensionResults().prf after processing.

### Example of Obtaining a Fixed Key During Authentication (Sign-in)

In WebAuthn client extensions, if you pass an arbitrary byte sequence (BufferSource) to the eval field, you get a PRF calculation result (32 bytes) with that value as input. The following is a code example that evaluates PRF with a specific string "Foo encryption key" as input, and displays the result in Base64.

```javascript
const publicKey = {
  // ...normal options like challenge, RP info, user info...
  challenge: new Uint8Array([1,2,3,4]).buffer,  // Random challenge from the server
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

In the above, it requests the PRF extension with navigator.credentials.get() and sets the string to eval.first. If the authenticator and browser support PRF, a 32-byte ArrayBuffer will be stored in getClientExtensionResults().prf.results.first (in the example, it is Base64 encoded and output to the console). In an actual application, this obtained byte sequence would be used with the Web Crypto API (e.g., as an AES-GCM key) to decrypt stored data. What's important is that this key is unique to each credential and can only be obtained through the authentication operation. This means third parties cannot obtain this key without going through the user's authentication process, ensuring security.

### Example of Enabling the PRF Extension When Registering a New Passkey

The extensions.prf can also be specified during credential creation (registration). Under the original CTAP specification it was not possible to obtain PRF results during registration, and only a flag indicating whether the authenticator supports PRF (enabled) was obtained; however, support for "PRF-on-create" has since progressed, and in supported environments (e.g., Chrome 147+ or Firefox 147+) the PRF results can now be obtained at creation time. In any case, it is worthwhile to request the PRF extension during registration as it also serves as an indicator that the credential can obtain PRF in subsequent authentications. Below is a code example requesting the PRF extension when creating a passkey.

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
  challenge: new Uint8Array([0]).buffer,  // Dummy value since attestation is not used
  extensions: { prf: {} }  // Request PRF extension (no input value)
};
navigator.credentials.create({ publicKey })
  .then(cred => {
    console.log(cred.getClientExtensionResults().prf);
    // Expected output: { enabled: true/false, results: {...} }
  });
```

In this example, extensions: { prf: {} } is specified without giving specific eval input. In this case, getClientExtensionResults().prf returns the enabled property (indicating whether PRF functionality is supported), and in environments that support PRF-on-create the results are returned as well. With a PRF-capable authenticator the output is { enabled: true, ... }, while an authenticator without hmac-secret support returns { enabled: false }. Using this information, the application side can set a flag for "whether this credential can be used for data decryption later", and if false, provide warnings or fallback means to the user.

### Demo Implementations and Libraries

Several public demos and libraries have also emerged as proofs of concept for the WebAuthn PRF extension. For example, a WebAuthn PRF Extension demo page published by Chrome developers introduced a sample that actually tries the PRF extension in a Chrome Canary (with flags enabled) environment and displays the obtained byte sequence on screen. This demo also includes a fallback that simulates operation when the browser does not support it, which is useful for confirming the behavior of the PRF extension.

Also, WebAuthn implementation libraries such as SimpleWebAuthn and various server-side FIDO libraries are advancing support for the PRF extension in their latest versions. For example, SimpleWebAuthn can analyze authenticationExtensionsClientOutputs.prf sent from the client and pass the obtained byte sequence directly to the application (discussions on GitHub also mention considering the use of PRF in line with Safari support).

Furthermore, implementation has begun in actual services such as Bitwarden and 1Password. Bitwarden uses the PRF extension for passkey login to the web vault, implementing a mechanism where users obtain a key to decrypt the encrypted password vault at the same time as authenticating with a passkey. Thus, the PRF extension, which was at a theoretical stage, is gradually beginning to be used in real applications, and its code examples and implementation insights are being shared in various blogs.

## 5. Links to Official Documentation and Specifications, and Notes for Implementation

As official references, the W3C WebAuthn Level 3 specification and related FIDO2 CTAP specifications are primary. The relevant section "10.1.4 Pseudo-random function extension (prf)" in the W3C specification describes in detail the purpose, data structure, and processing procedures of the PRF extension. By reviewing this original specification, developers can correctly understand differences between browser implementations and security considerations.

For example, the specification clearly states that **"the provided PRF input is hashed after being concatenated with a fixed context string before being passed to the authenticator"**, which guarantees that "HMAC values obtained via WebAuthn do not collide with HMACs used for other purposes (such as OS login)". Also, at the CTAP level, as mentioned earlier, the hmac-secret extension (FIDO2 v2.1) is the basis, and its specification can also be referenced in FIDO Alliance documents.

- [WebAuthn Level 3 Specification § PRF Extension (W3C Candidate Recommendation)](https://www.w3.org/TR/webauthn-3/#prf-extension)
- [Explainer (Design explanation & code examples)](https://github.com/w3c/webauthn/wiki/Explainer:-PRF-extension)

### Implementation Notes and Constraints

#### Compatibility Checks and Fallbacks

As mentioned earlier, the PRF extension does not work in all environments. It only functions when the browser, OS, and authenticator all support it, so if any one of them does not support it, no result is obtained (getClientExtensionResults() becomes undefined or enabled:false). Therefore, during implementation, it is necessary to always check the content of getClientExtensionResults().prf and have a fallback process to obtain keys using traditional methods if the expected result (such as results.first) does not exist. For example, Bitwarden adopts a two-step approach where, if a passkey does not support PRF, it performs passkey authentication itself but uses the traditional master password for decryption.

#### User Experience and Security UI

When using the PRF extension, the user's operation in the authentication flow itself does not differ from normal WebAuthn (prompts for Touch ID or security key touch are the same), but additional data is exchanged behind the scenes. Because of this, note that in Windows environments when using an external security key + PIN, the user may be required to enter a PIN due to the constraints of the HMAC-secret extension (if the authenticator uses HMAC-secret without internal UV, UV via PIN is necessary).

Also, it has been pointed out that general users may not easily recognize that "this passkey is also decrypting data", so it is desirable to provide sufficient explanation and backup means regarding risks when deleting or losing a passkey. In particular, if data is encrypted with keys obtained through PRF, there is a risk that data cannot be restored if that credential is lost, so measures such as registering multiple passkeys or issuing emergency codes are important in practical use.

#### Technical Specification Constraints

Under the current specification, up to two PRF inputs can be evaluated simultaneously in a single authentication (first and second). If two values are passed, both results.first and results.second can be obtained. This allows servers to handle advanced uses such as key rotation.

For example, always putting a new random value in second for the next time, obtaining and using the current key from first while preparing the key for the next login calculated from second. When implementing, consider such API specifications for two-value input and result mapping (such as the evalByCredential option indicating which result corresponds to which credentialId). Especially when specifying multiple credentials with allowCredentials to obtain PRF, you need to map inputs for each CredentialID to evalByCredential (Web Authentication: An API for accessing Public Key Credentials - Level 3), and be careful as NotSupportedError or SyntaxError will be thrown if the format is incorrect (Web Authentication: An API for accessing Public Key Credentials - Level 3).

## Last Re-verification Date and Sources

Because PRF extension support status changes rapidly, this document requires periodic re-verification.

- **Last re-verification date**: 2026-05-17
- Primary sources:
  - [Web Authentication: An API for accessing Public Key Credentials - Level 3 (W3C)](https://www.w3.org/TR/webauthn-3/)
  - [Web Authentication extensions - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/WebAuthn_extensions)
  - [Bug 1863819 - [meta] Support WebAuthn PRF extension (Mozilla)](https://bugzilla.mozilla.org/show_bug.cgi?id=1863819)
  - [Developers Guide to PRF (Yubico)](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html)
  - [Microsoft webauthn.h (`WEBAUTHN_API_VERSION_8` / hmac-secret definitions)](https://github.com/microsoft/webauthn/blob/master/webauthn.h)
  - Official blogs and release notes of the password managers (Bitwarden / 1Password / Dashlane)
  - The exact date Windows Hello gained PRF support is not officially documented by Microsoft; community reports (Corbado / the Bitwarden community, etc.) are useful references, but verification on actual hardware is preferable
