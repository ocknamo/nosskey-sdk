# Nosskey SDK - TypeScript Interface Design

## Overview
Nosskey SDK provides a way to derive Nostr identity from passkeys, enabling secure and user-friendly authentication. The SDK supports both signup (registration) and login flows using passkeys. Note that after registering a passkey, you must call `deriveKey` to create the Nostr private key.

## Interfaces

### NosskeyOptions
Configuration options for the Nosskey SDK.

```typescript
interface NosskeyOptions {
  /** Stable user identifier (e.g., email) */
  userId: string;
  
  /** App namespace to isolate derived keys */
  appNamespace: string;
  
  /** Optional salt to further scope the derivation */
  salt?: string;
  
  /** WebAuthn options override */
  webAuthnOptions?: CredentialRequestOptions;
}
```

### NosskeyDerivedKey
Represents the derived Nostr key pair and associated authentication data.

```typescript
interface NosskeyDerivedKey {
  /** 32-byte nostr private key */
  sk: Uint8Array;
  
  /** 32-byte nostr public key */
  pk: Uint8Array;
  
  /** WebAuthn credential ID used for the signature */
  credentialId: Uint8Array;
  
  /** WebAuthn raw signature for audit/debug */
  rawSignature: Uint8Array;
}
```

## Class: Nosskey

### Constructor
```typescript
constructor(options: NosskeyOptions)
```

### Methods

#### registerPasskey()
Registers a new passkey for a user (Signup flow). This method should be called when a user first sets up their account. Note that this method only registers the passkey and does not create the Nostr private key. You must call `deriveKey` after successful registration to create the private key.

```typescript
registerPasskey(options: {
  /** Default: current domain */
  rpID?: string;
  
  /** Display name of app/site */
  rpName?: string;
  
  /** Stable ID per user (required by WebAuthn) */
  userID: string;
  
  /** Optional (fallback = userID) */
  userDisplayName?: string;
  
  /** Optional, default = fixed or random */
  challenge?: Uint8Array;
}): Promise<{
  /** Whether the registration was successful */
  success: boolean;
  
  /** Error message if registration failed */
  error?: string;
  
  /** For reference, not required to store */
  credentialID?: ArrayBuffer;
}>
```

#### deriveKey()
Derives a Nostr key pair using the registered passkey (Login flow). This method should be called:
1. After successful passkey registration to create the initial private key
2. When a user wants to authenticate and access their Nostr identity

```typescript
deriveKey(): Promise<NosskeyDerivedKey>
```

#### generateChallenge()
Utility method to create deterministic challenge buffer from userId + namespace + salt.

```typescript
static generateChallenge(
  userId: string,
  namespace: string,
  salt?: string
): Promise<Uint8Array>
```

#### deriveKeyFromSignature()
Utility method to import an existing raw signature and derive Nostr keys.

```typescript
static deriveKeyFromSignature(signature: Uint8Array): NosskeyDerivedKey
```

#### toHex()
Utility method to convert Nostr keys to hex string.

```typescript
static toHex(buf: Uint8Array): string
```

## Testing Utilities

### registerDummyPasskey()
Optional helper function for testing and debugging purposes.

```typescript
function registerDummyPasskey(userId: string): Promise<PublicKeyCredential>
```

