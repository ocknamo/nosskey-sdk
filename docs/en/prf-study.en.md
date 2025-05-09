# Latest Trends and Support Status of WebAuthn PRF Extension (as of April 2025)

## Research Items

- Browsers and their versions that currently (2025) support the PRF extension
- PRF support status for platform authenticators (Windows Hello, macOS Touch ID, Android, etc.) and security keys (YubiKey, SoloKey, etc.)
- Standardization status of the PRF extension in WebAuthn Level 3 (position within W3C)
- Availability of code examples or demo implementations using the PRF extension
- Official documentation and specifications related to the PRF extension

## 1. Standardization Status of the PRF Extension (Position in WebAuthn Level 3 Specification)

The Pseudo-Random Function (PRF) extension for WebAuthn is one of the new features added in the W3C Web Authentication Level 3 specification. Currently, this Level 3 specification is at the Working Draft stage (with the latest version published as of January 27, 2025), and feedback on consideration and implementation is progressing toward final recommendation.

The PRF extension was introduced while maintaining backward compatibility with WebAuthn Level 1/2, enabling the acquisition of pseudo-random function (PRF) output tied to the authenticator in addition to user authentication. Specifically, this extension allows hash calculations using secret keys such as HMAC to be performed on the authenticator side, making the results (32-byte binary) available for use on the web side.

The PRF extension is defined as one of the client extensions and authenticator extensions, and can be requested during registration (credential creation) and authentication (assertion). The extension identifier is "prf", and internally it is implemented using the hmac-secret extension of FIDO2 CTAP.

Originally, CTAP2's hmac-secret was designed for functions such as local data decryption in Windows Hello, but the WebAuthn PRF extension standardizes it to be handled from the web as a general-purpose pseudo-random function service. For example, the PRF extension allows acquiring a secret 32-byte value tied to each credential, which web applications can use for encrypting user data. By enabling the generation and acquisition of secret key material simultaneously with authentication, new use cases such as end-to-end encryption become possible.

Currently (April 2025), the wording of the PRF extension in the W3C specification is becoming finalized, and implementation is progressing. The status in the specification is **"Working Draft"**, but considering the implementation status in major browsers, it is expected to advance to the Candidate Recommendation stage soon. In addition to the PRF extension, Level 3 adds multiple extensions (such as cross-origin authentication and Device Public Key extension), and the W3C WebAuthn WG is trying to complete the specification while collecting implementation reports for each feature.

The official specification shows detailed definitions and processing procedures for the PRF extension. When input is passed to extensions.prf from the client JS API, the browser (user agent) first calculates a SHA-256 hash by adding the context string "WebAuthn PRF" to the input value, and sends it to the authenticator via CTAP. On the authenticator side, it calculates the internal PRF (HMAC) based on that hash value and returns the result (in this case, the user verification requirements are automatically adjusted to be satisfied). The browser decrypts the result returned from the authenticator (encrypted buffer in the CTAP hmac-secret extension) and provides the result to the web page through getClientExtensionResults(). Through this series of processes, web applications can access a 32-byte length secret securely generated during the authentication flow.

## 2. Support Status for Each Browser (Chrome, Safari, Firefox, Edge, etc.)

The PRF extension is currently being implemented ahead of schedule in Chromium-based browsers. In Google Chrome, it has been enabled by default since version 116, allowing the PRF extension to be used without flags. The stable version of Chrome 116 was released in mid-2023, and subsequent versions of Chrome (and browsers using the same Blink engine) support the PRF extension. Microsoft Edge (Chromium-based) similarly supports the PRF extension at the same timing as Chrome. In fact, Bitwarden's blog (January 2024) also mentions that "PRF extension is currently supported in Chromium-based browsers (Chrome and Edge)". Therefore, it can be generally assumed that the PRF extension can be used in the latest versions of Chrome-based browsers (including Opera, Brave, etc.).

For Mozilla Firefox, implementation was completed during 2024-2025. The PRF extension functionality was released in Firefox version 135, making it available in Windows environments as well. The Firefox development team has implemented it gradually, calling it "Baseline support", and the extension support for the desktop version was completed with Firefox 135 (released in early 2025). In fact, when Firefox 135 was released, it was reported in the community that "Finally, Firefox also supports the FIDO2 PRF extension". Therefore, developers using Firefox can test and provide WebAuthn features using the PRF extension, assuming they have version 135 or higher.

For Safari (WebKit), Apple started supporting it a bit later, but support has been added in the latest OS releases. Safari depends on iOS and macOS versions, but it supports the PRF extension since iOS/iPadOS 18 and the next release after macOS 14 (Sonoma). Specifically, PRF extension support was implemented in the beta version of Safari 18 (equivalent to iOS 18, macOS 14.1) announced at WWDC 2024, and the WebAuthn PRF extension has been enabled from Safari 18. Since the engine is unified to WebKit on Apple's platforms, not only Safari but also other browser apps on iOS such as Chrome and Firefox (internally using WebKit) can use the PRF extension if they are on iOS 18 or later. However, issues with cross-device authentication have been reported in the early releases of iOS 18 (18.0-18.3), and while they were fixed in 18.4, there are aspects that are still in the process of stabilization. For macOS as well, it officially supports the combination of macOS 15 (tentative name) + Safari 18 released in 2024, and Safari 17 prior to that does not support it.

To summarize, support for the PRF extension has been completed across the four major browsers during 2024-2025. Chrome/Edge had already reached practical stages in late 2023 to early 2024, Firefox followed in early 2025, and Safari/WebKit completed support in late 2024. Note that there are differences in support status between desktop and mobile versions of each browser. For example, Android versions of Chrome/Edge support the PRF extension like their desktop counterparts, functioning in combination with Android platform credentials. On the other hand, Firefox for Android (GeckoView) is not yet supported at the time of writing, and implementation for mobile versions is delayed. Thus, since the support status varies depending on the device and OS, developers need to be mindful of compatibility for each target environment.

## 3. Support Status for Platform Authenticators and Security Keys

The availability of the WebAuthn PRF extension depends not only on the browser but also on authenticator support. To fully utilize the PRF extension, all three layers must support it:
1. Authenticator (hardware/platform)
2. OS (authentication API layer)
3. Browser

Browser implementation is as mentioned above, but this section explains the support status of authenticators (platform authenticators and roaming security keys).

### Windows Hello (Platform Authenticator)

Currently, Windows platform authentication (Windows Hello) does not support the PRF extension because it does not support the HMAC-secret extension of CTAP. For platform passkeys using biometric authentication or PIN on Windows 10/11, the HMAC-secret function is not implemented, so when a PRF request is made, it behaves like **getClientExtensionResults().prf.enabled being false** because it cannot be processed on the authenticator side. In fact, the non-support of PRF by Windows Hello has been pointed out in the Microsoft community, and future support is desired. Therefore, to use the PRF extension in a Windows environment, you need to use a security key (mentioned later).

### macOS Touch ID (and Passkeys on iCloud Keychain)

Apple has incorporated the HMAC-secret function in the latest OS, so platform authenticators using Touch ID (Secure Enclave) on macOS 15 and later support the PRF extension. Touch ID on macOS 14 (Sonoma) and earlier did not support PRF, but support was added in the macOS released in late 2024. This allows Safari 18+ to obtain PRF from Touch ID. For other browsers like Chrome, if implementations that use Apple's platform authentication API (already implemented in Chrome 132 and later) are enabled in the future, it is expected that PRF using Touch ID will be possible on macOS (at the time of writing, Chrome has implemented support for Mac's platform authentication but it has not been released).

**Summary**: The PRF extension can be used from platform passkeys in the latest macOS environment (macOS 15 + Safari 18 and later). Developers also need to be aware of macOS version requirements.

### iOS/iPadOS Face ID / Touch ID (Platform Authenticator)

Passkeys on iPhone and iPad (stored in iCloud Keychain) support the PRF extension with iOS/iPadOS 18. PRF was not supported in iOS 17 and earlier, but PRF output is possible via the WebAuthn API in 18.0 and later. This makes use cases for obtaining encryption keys using device-internal passkeys from mobile Safari or browsers via WebView realistic. For **cross-device authentication (CDA/Hybrid)** cases where an iPhone is used for authentication on another device, it has been confirmed that PRF output works stably in iOS 18.4 and later. Unlike Android, since other browsers on iOS also internally use the WebKit engine, they have the same constraints and support status as Safari.

### Android Platform Authenticator (Google Play Services Passkeys)

Android has supported CTAP hmac-secret relatively early, and Android-compatible passkeys generally support the PRF extension. Android Passkeys implemented by Google (FIDO2 credentials tied to a Google account or stored locally on the device) have the HMAC-secret function, and when requesting the PRF extension in the Android versions of Chrome/Edge, you can successfully obtain a 32-byte key. It has been reported that PRF can also be used via Android's authentication features in Chromium-derived browsers such as Samsung Internet. On the other hand, Firefox for Android (Gecko) is currently unavailable due to lack of browser support. In the case of Android, since the OS provides a common FIDO2 API (FIDO module of Google Play Services) to each browser, it can be said that support at the OS and authenticator levels is relatively unified.

### Security Keys (Roaming Authenticators)

Many FIDO2 security keys such as YubiKey, SoloKey, and Feitian support the HMAC-secret extension of CTAP2. Therefore, the PRF extension can be used with those keys. For example, Yubico's Security Key series and YubiKey 5 series implement HMAC-secret and can return a 32-byte HMAC result in response to a PRF extension request (the usage of the HMAC-secret extension is also described in Yubico developer documentation). Open-source FIDO2 keys such as SoloKeys also support it similarly.

As a note, it is recommended to register security keys in FIDO2 mode as Discoverable Credentials (resettable credentials that can handle loss) to use PRF. Even with non-Discoverable credentials, PRF can be obtained by specifying allowCredentials, but many cases of user data encryption assume passkey operation (Discoverable credentials). In fact, Bitwarden and others also adopt the method of "registering a passkey (= Discoverable FIDO2 credential) and obtaining an encryption key using the PRF extension at that time".

Based on the above, only Windows platform authenticators are currently the exception that does not support it, and other major authenticators (Apple and Google platforms, external security keys) have the HMAC-secret function. Developers should be aware that there are combinations where the PRF extension may not be available depending on the user's environment (e.g., using Windows Hello + Chrome), and prepare fallback means. For example, while passkey authentication itself is possible on Windows, PRF cannot be obtained, so design considerations such as having users enter a decryption password separately as before are necessary. On the other hand, since PRF can be smoothly used with Android or security keys, it is desirable to handle conditional branching and UI guidance according to the support status of each platform.

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

The extensions.prf can also be specified during credential creation (registration). However, under the current CTAP specification, it is not possible to obtain PRF results immediately during registration, and only a flag indicating whether the authenticator supports PRF (enabled) is obtained. Still, it is worthwhile to request the PRF extension during registration as it serves as an indicator that the credential can obtain PRF in subsequent authentications. Below is a code example requesting the PRF extension when creating a passkey.

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

In this example, extensions: { prf: {} } is specified without giving specific eval input. Many authenticators cannot execute PRF evaluation at the registration stage, so in this case, it is expected that getClientExtensionResults().prf will return the enabled property (indicating whether PRF functionality is supported). For example, with a YubiKey, the output would be { enabled: true, results: {} }, while with a platform authenticator (like Windows Hello), it would be enabled: false. Using this information, the application side can set a flag for "whether this credential can be used for data decryption later", and if false, provide warnings or fallback means to the user.

### Demo Implementations and Libraries

Several public demos and libraries have also emerged as proofs of concept for the WebAuthn PRF extension. For example, a WebAuthn PRF Extension demo page published by Chrome developers introduced a sample that actually tries the PRF extension in a Chrome Canary (with flags enabled) environment and displays the obtained byte sequence on screen. This demo also includes a fallback that simulates operation when the browser does not support it, which is useful for confirming the behavior of the PRF extension.

Also, WebAuthn implementation libraries such as SimpleWebAuthn and various server-side FIDO libraries are advancing support for the PRF extension in their latest versions. For example, SimpleWebAuthn can analyze authenticationExtensionsClientOutputs.prf sent from the client and pass the obtained byte sequence directly to the application (discussions on GitHub also mention considering the use of PRF in line with Safari support).

Furthermore, implementation has begun in actual services such as Bitwarden and 1Password. Bitwarden uses the PRF extension for passkey login to the web vault, implementing a mechanism where users obtain a key to decrypt the encrypted password vault at the same time as authenticating with a passkey. Thus, the PRF extension, which was at a theoretical stage, is gradually beginning to be used in real applications, and its code examples and implementation insights are being shared in various blogs.

## 5. Links to Official Documentation and Specifications, and Notes for Implementation

As official references, the W3C WebAuthn Level 3 specification and related FIDO2 CTAP specifications are primary. The relevant section "10.1.4 Pseudo-random function extension (prf)" in the W3C specification describes in detail the purpose, data structure, and processing procedures of the PRF extension. By reviewing this original specification, developers can correctly understand differences between browser implementations and security considerations.

For example, the specification clearly states that **"the provided PRF input is hashed after being concatenated with a fixed context string before being passed to the authenticator"**, which guarantees that "HMAC values obtained via WebAuthn do not collide with HMACs used for other purposes (such as OS login)". Also, at the CTAP level, as mentioned earlier, the hmac-secret extension (FIDO2 v2.1) is the basis, and its specification can also be referenced in FIDO Alliance documents.

### Implementation Notes and Constraints

#### Compatibility Checks and Fallbacks

As mentioned earlier, the PRF extension does not work in all environments. It only functions when the browser, OS, and authenticator all support it, so if any one of them does not support it, no result is obtained (getClientExtensionResults() becomes undefined or enabled:false). Therefore, during implementation, it is necessary to always check the content of getClientExtensionResults().prf and have a fallback process to obtain keys using traditional methods if the expected result (such as results.first) does not exist. For example, Bitwarden adopts a two-step approach where, if a passkey does not support PRF, it performs passkey authentication itself but uses the traditional master password for decryption.

#### User Experience and Security UI

When using the PRF extension, the user's operation in the authentication flow itself does not differ from normal WebAuthn (prompts for Touch ID or security key touch are the same), but additional data is exchanged behind the scenes. Because of this, note that in Windows environments when using an external security key + PIN, the user may be required to enter a PIN due to the constraints of the HMAC-secret extension (if the authenticator uses HMAC-secret without internal UV, UV via PIN is necessary).

Also, it has been pointed out that general users may not easily recognize that "this passkey is also decrypting data", so it is desirable to provide sufficient explanation and backup means regarding risks when deleting or losing a passkey. In particular, if data is encrypted with keys obtained through PRF, there is a risk that data cannot be restored if that credential is lost, so measures such as registering multiple passkeys or issuing emergency codes are important in practical use.

#### Technical Specification Constraints

Under the current specification, up to two PRF inputs can be evaluated simultaneously in a single authentication (first and second). If two values are passed, both results.first and results.second can be obtained. This allows servers to handle advanced uses such as key rotation.

For example, always putting a new random value in second for the next time, obtaining and using the current key from first while preparing the key for the next login calculated from second. When implementing, consider such API specifications for two-value input and result mapping (such as the evalByCredential option indicating which result corresponds to which credentialId). Especially when specifying multiple credentials with allowCredentials to obtain PRF, you need to map inputs for each CredentialID to evalByCredential (Web Authentication: An API for accessing Public Key Credentials - Level 3), and be careful as NotSupportedError or SyntaxError will be thrown if the format is incorrect (Web Authentication: An API for accessing Public Key Credentials - Level 3).
