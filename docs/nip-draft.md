NIP-XX  
Passkey-Wrapped Keys
==========================

`draft` `optional`

This NIP defines a method for managing Nostr private keys using WebAuthn passkeys (FIDO2/WebAuthn credentials). By using passkeys, there is no need for private key backup or complex password management, enabling users to use Nostr with intuitive operations such as biometric authentication or simply touching a physical device.

This NIP uses the **PRF Direct Usage Method**: directly use values obtained from WebAuthn's PRF extension as Nostr private keys.

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

## PRF Direct Usage Method

A major feature of the PRF direct usage method is that **the private key is not explicitly stored**. Instead, a private key is temporarily derived from the PRF value obtained from the passkey when signing is needed. Since the same Nostr key is always generated from the same passkey and the same salt, even if the key information is lost, it can be restored with the same passkey.

### Data Structure

Only the minimum information needed to associate with the passkey is stored:

```jsonc
{
  "credentialId": "a3f5b8c12d...9f", // Passkey identifier (hex format)
  "pubkey": "02ab34cd56...ef", // Nostr public key (hex format)
  "salt": "6e6f7374722d6b6579", // Salt for PRF derivation (hex format, fixed value)
  "username": "alice" // Username when creating the passkey (optional)
}
```

### Salt Value Specification

To generate the same Nostr key, the salt value must be unified across implementations. Standard salt value:

```
"nostr-key" (UTF-8 bytes: 0x6e6f7374722d6b6579)
```

## Security Considerations

Unlike the signature mechanism of passkeys themselves, for signing Nostr events, the private key needs to be temporarily decrypted within the client application. Balancing with UX, the private key should be promptly cleared from memory when not needed.
