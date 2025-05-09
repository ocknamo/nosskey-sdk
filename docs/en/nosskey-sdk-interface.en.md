# Passkey-Wrapped Key (PWK) - TypeScript SDK Interface Definition and Implementation Guide

**A simple implementation example not adopting NIP-49**

This SDK implementation adopts a simple approach that directly uses the high-entropy values obtained from the WebAuthn PRF extension for AES-GCM encryption, without using scrypt or XChaCha20-Poly1305 as specified in NIP-49. This allows for implementation using only the standard Web Crypto API without depending on additional libraries, achieving excellent performance.

## Overview

This document introduces the interface design and implementation examples of important methods for the TypeScript SDK implementation of Passkey-Wrapped Key (PWK).

**Note**: This SDK is not fully completed for production environments, and edge case handling, revocation processing, logging implementation, and complete cryptographic hardening have not been fully tested. It primarily demonstrates:

- Public interfaces (types and classes)
- Key methods: Implementation of `createPasskey()`, `importNostrKey()`, `generateNostrKey()`, `directPrfToNostrKey()`, `signEventWithPWK()`, `isPrfSupported()`
- Usage examples

## 1. Public Interfaces and Type Definitions

```typescript
/**
 * PWK blob structure (format for storing encrypted private keys)
 */
export interface PWKBlobEncrypted {
  v: 1;
  alg: 'aes-gcm-256';
  salt: string; // hex(16 B)
  iv: string; // hex(12 B)
  ct: string; // hex(32 B)
  tag: string; // hex(16 B)
  credentialId: string; // Credential ID stored in hex format
  pubkey: string; // Public key (hex format)
  username?: string; // Username when creating passkey (only if available)
}

/**
 * PWK blob - Direct PRF usage method
 */
export interface PWKBlobDirect {
  v: 1;
  alg: 'prf-direct';
  credentialId: string; // hex format
  pubkey: string; // Public key (hex format)
  username?: string; // Username when creating passkey (only if available)
}

export type PWKBlob = PWKBlobEncrypted | PWKBlobDirect;

/**
 * Passkey creation options
 */
export interface PasskeyCreationOptions {
  rp?: {
    name?: string;
    id?: string;
  };
  user?: {
    name?: string;
    displayName?: string;
  };
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  pubKeyCredParams?: PublicKeyCredentialParameters[];
  extensions?: Record<string, unknown>;
}

/**
 * Key options
 */
export interface KeyOptions {
  clearMemory?: boolean; // Whether to clear the private key from memory after operation (default: true)
  username?: string; // Username when creating passkey
}

/**
 * Cache options type definition
 */
export interface KeyCacheOptions {
  /** Whether to enable caching */
  enabled: boolean;
  /** Cache expiration time (milliseconds) */
  timeoutMs?: number;
}

/**
 * Sign options
 */
export interface SignOptions {
  clearMemory?: boolean; // Whether to clear the private key from memory after operation (default: true)
  tags?: string[][]; // Additional tags
  /** Whether to cache the private key. Follows global settings if not specified */
  useCache?: boolean;
}

/**
 * Options for PWK storage
 */
export interface PWKStorageOptions {
  /** Whether to enable PWK storage (default: true) */
  enabled: boolean;
  /** Storage to use (default: localStorage) */
  storage?: Storage;
  /** Key name used for storage (default: "nosskey_pwk") */
  storageKey?: string;
}

/**
 * SDK public interface
 */
export interface PWKManagerLike {
  /**
   * NIP-07 compatible: Get public key
   * Returns the public key from the currently set PWK
   */
  getPublicKey(): Promise<string>;

  /**
   * NIP-07 compatible: Sign event
   * Signs an event with the currently set PWK
   * @param event Nostr event to sign
   */
  signEvent(event: NostrEvent): Promise<NostrEvent>;

  /**
   * Set the current PWK
   * Also saves it if storage is enabled
   * @param pwk PWK to set
   */
  setCurrentPWK(pwk: PWKBlob): void;

  /**
   * Get the current PWK
   * Attempts to load from storage if not set
   */
  getCurrentPWK(): PWKBlob | null;
  
  /**
   * Check if a PWK exists
   * Searches from memory or storage according to storage settings
   * @returns Whether a PWK exists
   */
  hasPWK(): boolean;

  /**
   * Update PWK storage settings
   * @param options Storage options
   */
  setStorageOptions(options: Partial<PWKStorageOptions>): void;

  /**
   * Get current PWK storage settings
   */
  getStorageOptions(): PWKStorageOptions;

  /**
   * Clear PWK stored in storage
   */
  clearStoredPWK(): void;

  /**
   * Check if PRF extension is supported
   * Will require user action by the authenticator
   */
  isPrfSupported(): Promise<boolean>;

  /**
   * Create a passkey (also request PRF extension)
   * @param options Passkey creation options
   * @returns Returns credential identifier
   */
  createPasskey(options?: PasskeyCreationOptions): Promise<Uint8Array>;

  /**
   * Use PRF value directly as Nostr secret key
   * @param credentialId Credential ID to use (if omitted, the passkey selected by the user will be used)
   * @param options Options
   */
  directPrfToNostrKey(
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<PWKBlob>;

  /**
   * Wrap an existing Nostr private key with a passkey for protection
   * @param secretKey Existing private key to import
   * @param credentialId Credential ID to use (if omitted, the passkey selected by the user will be used)
   * @param options Options
   */
  importNostrKey(
    secretKey: Uint8Array,
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<PWKBlob>;

  /**
   * Generate a new Nostr private key and wrap it with a passkey
   * @param credentialId Credential ID to use (if omitted, the passkey selected by the user will be used)
   * @param options Options
   */
  generateNostrKey(
    credentialId?: Uint8Array,
    options?: KeyOptions
  ): Promise<PWKBlob>;

  /**
   * Sign an event
   * @param event Nostr event to sign
   * @param pwk Encrypted private key or direct PRF use (including credentialId)
   * @param options Signing options
   */
  signEventWithPWK(
    event: NostrEvent,
    pwk: PWKBlob,
    options?: SignOptions
  ): Promise<NostrEvent>;

  /**
   * Export encrypted private key
   * @param pwk Encrypted private key in PWKBlob format
   * @param credentialId Credential ID to use (if omitted, obtained from PWKBlob's credentialId, or the passkey selected by the user will be used)
   * @returns Exported private key (hexadecimal string)
   */
  exportNostrKey(pwk: PWKBlob, credentialId?: Uint8Array): Promise<string>;

  /**
   * Update cache settings
   * @param options Cache options
   */
  setCacheOptions(options: Partial<KeyCacheOptions>): void;

  /**
   * Get current cache settings
   */
  getCacheOptions(): KeyCacheOptions;

  /**
   * Clear the cache for a specific key
   * @param credentialId Credential ID
   */
  clearCachedKey(credentialId: Uint8Array | string): void;

  /**
   * Clear all cached keys
   */
  clearAllCachedKeys(): void;
}
```

## 3. Usage Examples

### 3.1 Creating a Passkey and Importing an Existing Nostr Key

```typescript
const pwkMgr = new PWKManager();

try {
  // Step 1: Create a passkey (user authentication UI displayed here)
  const credentialId = await pwkMgr.createPasskey();
  localStorage.setItem('pwkCredId', bytesToHex(credentialId));
  
  // Step 2: Import an existing Nostr private key
  // (e.g., a private key restored from nsec or managed internally by the app)
  const existingSecretKey = hexToBytes('7f...'); // 32-byte private key
  
  const result = await pwkMgr.importNostrKey(existingSecretKey, credentialId);
  localStorage.setItem('pwkBlob', JSON.stringify(result.pwkBlob));
  console.log(`Public key: ${result.publicKey}`);
  
} catch (e) {
  console.error('Passkey processing error:', e);
}

```

### 3.2 Generating a New Nostr Key

```typescript
// Generate a new Nostr key
try {
  const credentialId = hexToBytes(localStorage.getItem('pwkCredId'));
  
  // Generate a new random Nostr private key
  const result = await pwkMgr.generateNostrKey(credentialId);
  localStorage.setItem('pwkBlob', JSON.stringify(result.pwkBlob));
  console.log(`New public key: ${result.publicKey}`);
} catch (e) {
  console.error('Key generation error:', e);
}
```

### 3.3 Using PRF Value Directly as a Nostr Secret Key

```typescript
// Use PRF value directly as a secret key
try {
  const credentialId = hexToBytes(localStorage.getItem('pwkCredId'));
  
  // Use PRF value directly as a Nostr key
  const pwk = await pwkMgr.directPrfToNostrKey(credentialId);
  pwkMgr.setCurrentPWK(pwk);
  console.log(`Public key using direct PRF: ${pwk.publicKey}`);
  
  // Sign an event
  const event = {
    kind: 1,
    content: 'Direct PRF usage test',
    tags: [],
    created_at: Math.floor(Date.now() / 1000)
  };
  const signedEvent = await pwkMgr.signEvent(event);
  console.log('Signed event:', signedEvent);
  
} catch (e) {
  console.error('Direct PRF usage error:', e);
}
```

## 4. Notes and Pitfalls

| Item | Description |
|------|-------------|
| PWK Blob Storage | Encrypted private keys (PWK blobs) need to be stored securely, just like regular Nostr private keys. If lost, the Nostr private key is also lost. |
| Memory Clearance | Web Crypto buffers are detached by garbage collection, but explicit fill(0) for Uint8Arrays should still be done carefully. |
| Windows | Windows Hello (as of 2025-04) may not support the PRF extension. In such cases, it's good to guide users to alternative methods such as using passkeys on mobile devices. In most cases, the browser's passkey UI will provide appropriate guidance. |
| PRF Value Validity | When using PRF values directly as secret keys, there is a possibility (albeit extremely low) that they may not fall within the valid range of secp256k1. |
| Backup | It is recommended to store encrypted PWK blobs outside the device and make them restorable with additional passkeys (download and save to another device or backup to a relay) |

## 5. Implementation Points

### 5.1 Interface Design Features

| Method | Main Purpose | Use Case |
|--------|--------------|----------|
| createPasskey() | Create passkey only | Passkey registration (UI display 1st time). No private key processing |
| directPrfToNostrKey() | Direct PRF usage | Implementation that uses PRF value directly as a private key |
| importNostrKey() | Wrapping existing keys | For protecting existing nsec etc. with a passkey |
| generateNostrKey() | Generate new keys | Creating a new Nostr account |

### 5.2 Advantages of Using PRF Values Directly as Nostr Secret Keys

Main advantages of using PRF values directly as Nostr secret keys:

- **Simplification of Implementation**: No need for separate processes to generate and encrypt private keys
- **Clarification of Security Model**: Only the PRF value becomes the secret, eliminating the intermediate layer of key derivation
- **Improvement of User Experience**: Reduction in the number of operations (completed just with passkey authentication)

The probability of a PRF value not falling within the valid private key range of secp256k1 is negligibly low in practical terms (approximately 2^-224).
