# Nosskey SDK - Implementation Sample

## Overview
This document provides a sample implementation of the Nosskey SDK, demonstrating how to derive Nostr identity from passkeys.

## Implementation Details

### Class Structure
```typescript
export class Nosskey {
  private options: NosskeyOptions;

  constructor(options: NosskeyOptions) {
    this.options = options;
  }
}
```

### Key Derivation Method
The `deriveKey` method handles the passkey authentication and key derivation process.

```typescript
async deriveKey(): Promise<NosskeyDerivedKey> {
  // Generate challenge from user and app context
  const challenge = await Nosskey.generateChallenge(
    this.options.userId,
    this.options.appNamespace,
    this.options.salt
  );

  // Configure WebAuthn request
  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: undefined,
    timeout: 60000,
    userVerification: "preferred",
    ...this.options.webAuthnOptions,
  };

  // Request passkey authentication
  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential;

  const response = assertion.response as AuthenticatorAssertionResponse;
  const rawSignature = new Uint8Array(response.signature);
  const credentialId = new Uint8Array(assertion.rawId);

  // Derive private key from signature
  const hashBuffer = await crypto.subtle.digest("SHA-256", rawSignature);
  const sk = new Uint8Array(hashBuffer).slice(0, 32);

  // Convert private key to hex string and compute public key using rx-nostr
  const skHex = Nosskey.toHex(sk);
  const { getPublicKey } = await import('rx-nostr');
  const pkHex = getPublicKey(skHex);
  
  // Convert hex strings back to Uint8Array
  const pk = new Uint8Array(pkHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  return { sk, pk, credentialId, rawSignature };
}
```

### Passkey Registration
Implementation of the passkey registration process.

```typescript
async registerPasskey(options: {
  rpID?: string;
  rpName?: string;
  userID: string;
  userDisplayName?: string;
  challenge?: Uint8Array;
}): Promise<{
  success: boolean;
  error?: string;
  credentialID?: ArrayBuffer;
}> {
  try {
    const {
      rpID = window.location.hostname,
      rpName = window.location.hostname,
      userID,
      userDisplayName = userID,
      challenge = crypto.getRandomValues(new Uint8Array(32))
    } = options;

    // Ensure userID is within 64 bytes
    const userIdBytes = new TextEncoder().encode(userID).slice(0, 64);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: challenge.buffer,
      rp: {
        id: rpID,
        name: rpName
      },
      user: {
        id: userIdBytes,
        name: userID,
        displayName: userDisplayName
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -8, type: "public-key" },   // EdDSA (optional)
        { alg: -257, type: "public-key" }  // RS256 (optional fallback)
      ],
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred"
      },
      timeout: 60000,
      attestation: "none"
    };

    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;

    if (!credential || !credential.rawId) {
      throw new Error("Credential creation failed or returned null");
    }

    return {
      success: true,
      credentialID: credential.rawId
    };

  } catch (err) {
    return {
      success: false,
      error: (err instanceof Error) ? err.message : String(err)
    };
  }
}
```

### Utility Methods

#### Challenge Generation
Creates a deterministic challenge buffer from user and app context.

```typescript
static async generateChallenge(
  userId: string,
  namespace: string,
  salt?: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const base = `${userId}@${namespace}${salt ? ":" + salt : ""}`;
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(base));
  return new Uint8Array(hash);
}
```

#### Signature-based Key Derivation
Imports an existing raw signature and derives Nostr keys.

```typescript
static deriveKeyFromSignature(signature: Uint8Array): NosskeyDerivedKey {
  const hash = new Uint8Array(
    Array.from(signature).length === 64
      ? signature
      : new Uint8Array(crypto.subtle.digestSync("SHA-256", signature))
  );
  const sk = hash.slice(0, 32);
  
  // Convert private key to hex string and compute public key using rx-nostr
  const skHex = Nosskey.toHex(sk);
  const { getPublicKey } = require('rx-nostr');
  const pkHex = getPublicKey(skHex);
  
  // Convert hex strings back to Uint8Array
  const pk = new Uint8Array(pkHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  return {
    sk,
    pk,
    credentialId: new Uint8Array(),
    rawSignature: signature,
  };
}
```

#### Hex Conversion
Converts Nostr keys to hex string format.

```typescript
static toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

## Testing Utilities

### Dummy Passkey Registration
Helper function for testing and debugging purposes.

```typescript
export function registerDummyPasskey(userId: string): Promise<PublicKeyCredential> {
  // Stub only - actual registration flow would require user gesture and HTTPS context
  return Promise.reject("Not implemented in SDK - implement in app context");
}
```

## Notes
- The implementation requires a secure context (HTTPS)
- User interaction is required for passkey authentication
- The SDK uses rx-nostr for key pair generation
- All cryptographic operations are performed in the browser
- Passkey registration requires user consent and biometric verification
- Private keys are converted to hex strings before public key derivation
- After registering a passkey, you must call `deriveKey` to create the Nostr private key
