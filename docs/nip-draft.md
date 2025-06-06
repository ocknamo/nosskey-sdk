NIP-XX  
Passkey-Wrapped Keys
==========================

`draft` `optional`

This NIP defines a method for managing Nostr private keys using WebAuthn passkeys (FIDO2/WebAuthn credentials). By using passkeys, there is no need for private key backup or complex password management, enabling users to use Nostr with intuitive operations such as biometric authentication or simply touching a physical device.

Two implementation approaches are proposed:

1. **PRF Direct Usage Method**: Directly use values obtained from WebAuthn's PRF extension as Nostr private keys
2. **Encryption Method**: Encrypt existing Nostr private keys with keys derived from passkeys

## About WebAuthn PRF Extension

The PRF (Pseudo-Random Function) extension of WebAuthn is a feature introduced in the WebAuthn Level 3 specification. This extension generates deterministic pseudo-random values from the internal private key of the authenticator (security key or platform authenticator) and a provided salt.

Main features of the PRF extension:
- Generates 32-byte high-entropy values using the authenticator's internal private key
- The same PRF value is always obtained from the same credential information (credentialId) and the same salt
- Values do not leak outside the device and can only be obtained during authentication

### PRF Support Status

The availability of the PRF extension depends not only on browser support but also on the authenticator's support. To fully utilize the PRF extension, all three layers must support it:

- Authenticator (hardware/platform)
- OS (authentication API layer)
- Browser

While major OS and browsers support it, some major authenticators do not yet support it, so client implementers are recommended to implement fallbacks to existing Nostr authentication methods.

Reference: [PRF Support Status](https://github.com/ocknamo/nosskey-sdk/blob/main/docs/en/prf-support-tables.en.md)

### Conditions for Using PRF Values as Nostr Private Keys

For a 32-byte value obtained from the PRF extension to be used as a Nostr private key, it must be within the valid private key range of secp256k1 (from 1 to n-1, where n is the order of the curve).
It is recommended to perform range checking and regenerate or adjust if out of range, but since the theoretical probability of being out of range is approximately 2^-224, which is extremely low, range checking can be omitted in practice.

## PWKBlob Data Structure

PWKBlob (Passkey-Wrapped Key Blob) is a data structure for Nostr private keys protected by passkeys.

### PWKBlobDirect (PRF Direct Usage Method)

A major feature of the PRF direct usage method is that **the private key is not explicitly stored**. Instead, a private key is temporarily derived from the PRF value obtained from the passkey when signing is needed. Since the same Nostr key is always generated from the same passkey and the same salt, even if the PWKBlob is lost, it can be restored with the same passkey.

For example:

```jsonc
{
  v: 1, // Version
  alg: "prf-direct", // Algorithm identifier
  credentialId: "3a13e..a592d", // Passkey identifier (hex format)
  pubkey: "2b458..0c480", // Nostr public key (hex format)
  username: "jone"
}
```

### PWKBlobEncrypted (Encryption Method)

In the encryption method, the Nostr private key is encrypted using a PRF value obtained from the passkey and stored in the PWKBlob.
This NIP does not specify the encryption algorithm.

For example:

```jsonc
{
  v: 1; // Version
  alg: "aes-gcm-256", // Encryption algorithm
  salt: "a61c7..f645a", // Salt (hex format, 16 bytes)
  iv: "98f29..28d01", // Initialization vector (hex format, 12 bytes)
  ct: "517a2..8c140", // Encrypted private key (hex format, 32 bytes)
  tag: "01eb6..bbfb0", // Authentication tag (hex format, 16 bytes)
  credentialId: "3a13e..a592d", // Passkey identifier (hex format)
  pubkey: "2b458..0c480", // Nostr public key (hex format)
  username: "jack" // Username when creating the passkey (optional)
}
```

## PWKBlob Relay Backup

Since PWKBlobEncrypted contains an encrypted private key, it is recommended to save it as an event on Nostr relays in case device storage is lost.

### Example Event

```jsonc
{
  "kind": 30100,  // Dedicated event kind for PWKBlob
  "content": "{
    "pwkBlob": {      // PWKBlob object
      // PWKBlob contents
    },
    "description": "My primary device passkey", // Optional description
    "deviceInfo": {  // Optional device information for passkey restoration hints
      "name": "iPhone",
      "os": "iOS 18.0",
      "browser": "Safari 18"
    }
  }",
  "tags": [
    ["d", "<alg>:<credentialId>"],   // Set a combination of PWKBlob algorithm and credentialId as dtag to avoid duplicate backups of the same PWK
    ["p", "2b458..0c480"],   // Often matches the event creator
    ["t", "pwkblob"],         // Tag for searching
    ["client", "nosskey.app"]  // Optional client identification tag (NIP-89)
  ],
  // other fields...
}
```

### Restoration Process

1. Launch the application on a new device
2. Retrieve the latest kind 30100 event addressed to the target pubkey from relays
3. Extract the PWKBlob and decrypt it with the passkey's PRF value
4. Enable signing of Nostr events with the decrypted private key

### Multiple Device Support

When registering and backing up multiple passkeys, it is possible to create a PWKBlob for each passkey and store them in separate events on relays. This way, even if some passkeys are lost, you can still access your account with other passkeys.

## Comparison of Both Methods

| Characteristic | PRF Direct Usage (Recommended) | Encryption Method |
|:---------------|:------------------------------|:------------------|
| UX Improvement | ★★★★★ | ★★★ |
| Existing Key Support | ✗ Not possible | ✓ Possible |
| Management Effort | Minimal (automatic management) | Moderate (relay backup recommended) |
| Ease of Restoration | High (restoration with the same passkey) | Moderate (PWKBlob and passkey required) |
| Optimal Users | New users | Existing key holders |

## Security Considerations

Unlike the signature mechanism of passkeys themselves, for signing Nostr events, the private key needs to be temporarily decrypted within the client application. Balancing with UX, the private key should be promptly cleared from memory when not needed.
