# Secure Storage of Nostr Private Keys and Event Signing with WebAuthn (Passkeys)

## Table of Contents

- [Overview and Background](#overview-and-background)
- [Implementation Approaches for Nostr Private Key Management with Passkeys](#implementation-approaches-for-nostr-private-key-management-with-passkeys)
- [Direct Utilization of PRF Values (Recommended)](#direct-utilization-of-prf-values-recommended)
- [Encryption/Decryption Approach (Alternative Method)](#encryptiondecryption-approach-alternative-method)
- [User Experience and Security Balance](#user-experience-and-security-balance)
- [Technical Considerations and Security](#technical-considerations-and-security)
- [Summary and Future Outlook](#summary-and-future-outlook)

## Overview and Background

The Nostr protocol requires a private key to identify users and sign events, but the leakage of this private key poses a critical security risk. Many Nostr clients adopt methods such as storing private keys in plain text in the browser's local storage or encrypting them in password-protected format (such as NIP-49), but both methods have challenges in terms of security and convenience.

WebAuthn (passkeys) is a standard technology for making user authentication safer and simpler. It uses biometric authentication (fingerprint, face recognition) or security keys (such as YubiKey) during authentication, with the feature that private keys are securely stored inside the device. This document explains how to apply this technology to securely manage Nostr private keys.

## Implementation Approaches for Nostr Private Key Management with Passkeys

There are two major approaches to Nostr private key management using WebAuthn:

### Recommended Approach: Direct Use of PRF Values (for New Users)

Utilizes the PRF extension (Pseudo-Random Function extension) introduced in WebAuthn Level 3, using values derived from secrets within the Authenticator directly as Nostr private keys.

**Basic Mechanism**:
1. User registers a WebAuthn passkey
2. Obtains an output value for a fixed input (salt) using the PRF extension
3. Uses this value directly as a Nostr private key

**Benefits**: Simple, fast, fewer library dependencies (can be implemented with browser native API only)

### Alternative Approach: Encryption/Decryption of Private Keys (for Importing Existing Keys)

Encrypts and stores existing Nostr private keys (nsec) using PRF values from WebAuthn, and decrypts them for use when signing.

**Basic Mechanism**:
1. Import existing Nostr private key or generate a new one
2. Encrypt the private key using a PRF value from WebAuthn and store it
3. Decrypt the private key using re-authentication when signing, and use it

**Benefits**: Can import existing nsec, easier key sharing between multiple clients

### Approach Comparison and Selection Criteria

| Comparison Point | Direct Use of PRF Values (Recommended) | Encryption/Decryption Approach |
|:-----------------|:--------------------------------------|:------------------------------|
| Simplicity and Processing Speed | ★★★★★ | ★★★ |
| Import of Existing Keys | ✗ Not Supported | ✓ Supported |
| Implementation Complexity | Low | Moderate |
| Optimal Users | New Users | Users with Existing Keys |

For new users, directly utilizing PRF values is **recommended as the first choice**.

## Direct Utilization of PRF Values (Recommended)

### Technical Mechanism and Implementation

The PRF extension of WebAuthn generates a deterministic pseudo-random value from the internal private key of the Authenticator and the provided salt. Since the same value is always obtained with the same credential ID and the same salt, this can be used as a Nostr private key.

**Basic Implementation Steps**:

1. Register a WebAuthn passkey and enable the PRF extension
2. Obtain a PRF value using a fixed salt value
3. Use the obtained PRF value as a Nostr private key (for public key derivation, signing, etc.)
4. Promptly clear the private key from memory after use

Minimal implementation example using the PRF extension:

```javascript
// 1. Register a passkey (enable PRF extension)
const credential = await navigator.credentials.create({
  publicKey: {
    // Set necessary parameters...
    extensions: { prf: { eval: {} } }  // Enable PRF extension
  }
});

// 2. Obtain PRF value (when signing)
const assertion = await navigator.credentials.get({
  publicKey: {
    // Set necessary parameters...
    extensions: { prf: { eval: { first: fixedSalt } } }
  }
});
const prfResult = assertion.getClientExtensionResults().prf.results.first;

// 3. Use PRF value as a private key
const signature = signEvent(event, prfResult);

// 4. Clear from memory after use
prfResult.fill(0);
```

For more detailed implementation examples, refer to the [SDK Interface Details](sdk-if.md).

### Considerations and Limitations

1. **PRF Extension Support Status**: Not all browsers and authenticators support it (see [compatibility table](prf-support-tables.md))
2. **secp256k1 Range Constraint**: Theoretical possibility that PRF output values fall outside the valid private key range of the curve (probability of about 2^-224)
3. **Compatibility with Existing Keys**: Cannot import nsec keys
4. **Backup/Recovery**: Depends on passkey cloud synchronization (platform-dependent)
5. **Domain Constraint**: WebAuthn is tied to domains, so cannot migrate between apps on different domains

## Encryption/Decryption Approach (Alternative Method)

This approach encrypts existing Nostr private keys (nsec) using PRF values from WebAuthn. By directly using PRF values as encryption keys, additional key derivation (such as scrypt in NIP-49) can be omitted, balancing performance and security.

**Basic Flow**:
1. Generate or import private key
2. Obtain PRF value and use it as an AES-GCM key
3. Encrypt the private key and store it with metadata
4. When signing, re-obtain the PRF value, decrypt, sign, and clear

The biggest advantage of this approach is that it can import existing nsec keys. It allows protection of existing identities with passkeys.

## User Experience and Security Balance

### Authentication Experience and Usability

The Nostr signing flow using WebAuthn passkeys greatly improves UX compared to traditional password entry:

- **Simple Flow**: Just biometric authentication or PIN entry on the browser UI
- **Cross-Device**: Same experience on multiple devices with OS passkey synchronization features
- **Intuitive Operation**: Integrated into OS standard UI with a sense of "approving a post"

### Security Strength and Trade-offs

**Security Benefits**:
- Private keys are stored in the device's secure element, improving resistance to malware and keyloggers
- Enhanced security through multi-factor authentication (something you have, something you know, biometric information)
- Legitimate passkeys cannot be used on phishing sites

**Trade-offs**:
- Constraints based on browser and device compatibility
- Recovery methods depend on the platform
- Migration between platforms may become complex in some cases

Direct use of PRF values depends on the quality of cloud synchronization, but the encryption/decryption approach can provide recovery options through nsec export functionality. It is also worth considering functionality to export PRF values as nsec.

## Technical Considerations and Security

### Environment Dependency and Compatibility Status

WebAuthn and PRF extension compatibility varies by environment. See the [PRF Compatibility Table](prf-support-tables.md) for details. If the PRF extension is not available, alternative approaches (HMAC-secret extension, NIP-49, etc.) should be provided.

### Security Considerations

1. **Passkey Synchronization and Storage**:
   - Synced passkeys: High convenience but dependent on platform synchronization quality
   - Device-bound keys: Higher security but risk of loss

2. **NIP-49 Compatibility**:
   - PRF values are already high-entropy, making NIP-49's scrypt processing redundant
   - Browser-native encryption (such as AES-GCM) is more efficient

3. **Security Best Practices**:
   - Mandatory User Verification (UV): `userVerification: "required"`
   - Immediate clearing of private keys from memory
   - XSS protection through CSP settings

## Summary and Future Outlook

Nostr private key management utilizing WebAuthn passkeys and the PRF extension brings significant improvements in both security and user experience. Especially for new users, the direct use of PRF values approach is a simple, fast, and secure first choice.

**Main Conclusions**:
1. Direct use of PRF values is the optimal choice for new users
2. An implementation with fallback mechanisms according to the environment is ideal
3. Passkeys combine passwordless experience with high security

With this implementation approach, even general users can participate in the Nostr ecosystem while easily achieving high security.
