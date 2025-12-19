# Nosskey SDK Interface Specification (English)

## Overview

Nosskey SDK adopts a method that directly derives Nostr private keys using the PRF extension of WebAuthn passkeys. The PWKBlob concept has been abolished in favor of a simpler and more secure NostrKeyInfo structure.

## Main Type Definitions

### NostrKeyInfo

```typescript
/**
 * Nostr key information (PRF direct usage method only)
 * PWKBlob abolished, holding only simple key information
 */
export interface NostrKeyInfo {
  credentialId: string; // Credential ID stored in hex format
  pubkey: string; // Public key (hex format)
  salt: string; // Salt for PRF derivation (hex format, fixed value "6e6f7374722d6b6579")
  username?: string; // Username when creating passkey (only if available)
}
```

### NostrEvent

```typescript
/**
 * Nostr event JSON
 */
export interface NostrEvent {
  id?: string; // sha256 hash of serialized event
  pubkey?: string; // hex
  created_at?: number;
  kind: number;
  tags?: string[][];
  content: string;
  sig?: string; // hex
}
```

## Main Class: NosskeyManager

### Constructor

```typescript
constructor(options?: {
  cacheOptions?: Partial<KeyCacheOptions>;
  storageOptions?: Partial<NostrKeyStorageOptions>;
})
```

### NIP-07 Compatible Methods

#### getPublicKey()
Gets the public key from the currently set NostrKeyInfo.

```typescript
async getPublicKey(): Promise<string>
```

#### signEvent()
Signs an event with the currently set NostrKeyInfo.

```typescript
async signEvent(event: NostrEvent): Promise<NostrEvent>
```

### NostrKeyInfo Management Methods

#### setCurrentKeyInfo()
Sets the current NostrKeyInfo. Also saves to storage if storage is enabled.

```typescript
setCurrentKeyInfo(keyInfo: NostrKeyInfo): void
```

#### getCurrentKeyInfo()
Gets the current NostrKeyInfo. Attempts to load from storage if not set.

```typescript
getCurrentKeyInfo(): NostrKeyInfo | null
```

#### hasKeyInfo()
Checks if NostrKeyInfo exists.

```typescript
hasKeyInfo(): boolean
```

#### clearStoredKeyInfo()
Clears NostrKeyInfo stored in storage.

```typescript
clearStoredKeyInfo(): void
```

### Passkey Related Methods

#### isPrfSupported()
Checks if PRF extension is supported.

```typescript
async isPrfSupported(): Promise<boolean>
```

#### createPasskey()
Creates a passkey (also requests PRF extension).

```typescript
async createPasskey(options?: PasskeyCreationOptions): Promise<Uint8Array>
```

#### createNostrKey()
Creates NostrKeyInfo using PRF value directly as Nostr secret key.

```typescript
async createNostrKey(
  credentialId?: Uint8Array,
  options?: KeyOptions
): Promise<NostrKeyInfo>
```

### Signing Methods

#### signEventWithKeyInfo()
Signs an event with the specified NostrKeyInfo.

```typescript
async signEventWithKeyInfo(
  event: NostrEvent,
  keyInfo: NostrKeyInfo,
  options?: SignOptions
): Promise<NostrEvent>
```

### Export Methods

#### exportNostrKey()
Exports the private key.

```typescript
async exportNostrKey(
  keyInfo: NostrKeyInfo,
  credentialId?: Uint8Array
): Promise<string>
```

### Cache Management Methods

#### setCacheOptions()
Updates cache settings.

```typescript
setCacheOptions(options: Partial<KeyCacheOptions>): void
```

#### getCacheOptions()
Gets current cache settings.

```typescript
getCacheOptions(): KeyCacheOptions
```

#### clearCachedKey()
Clears cache for a specific key.

```typescript
clearCachedKey(credentialId: Uint8Array | string): void
```

#### clearAllCachedKeys()
Clears all caches.

```typescript
clearAllCachedKeys(): void
```

### Storage Management Methods

#### setStorageOptions()
Updates NostrKeyInfo storage settings.

```typescript
setStorageOptions(options: Partial<NostrKeyStorageOptions>): void
```

#### getStorageOptions()
Gets current NostrKeyInfo storage settings.

```typescript
getStorageOptions(): NostrKeyStorageOptions
```

## Option Type Definitions

### KeyCacheOptions

```typescript
export interface KeyCacheOptions {
  enabled: boolean; // Whether to enable cache
  timeoutMs?: number; // Cache expiration time (milliseconds)
}
```

### NostrKeyStorageOptions

```typescript
export interface NostrKeyStorageOptions {
  enabled: boolean; // Whether to enable NostrKeyInfo storage (default: true)
  storage?: Storage; // Storage to use (default: localStorage)
  storageKey?: string; // Key name for storage (default: "nosskey_keyinfo")
}
```

### KeyOptions

```typescript
export interface KeyOptions {
  username?: string; // Username when creating passkey
}
```

### SignOptions

```typescript
export interface SignOptions {
  clearMemory?: boolean; // Whether to clear private key from memory after operation (default: true)
  tags?: string[][]; // Additional tags
}
```

## Usage Examples

### Basic Usage

```typescript
import { NosskeyManager } from 'nosskey-sdk';

// Create instance
const nosskey = new NosskeyManager();

// Check PRF extension support
const isSupported = await nosskey.isPrfSupported();
if (!isSupported) {
  throw new Error('PRF extension not supported');
}

// Create passkey
const credentialId = await nosskey.createPasskey();

// Create NostrKeyInfo
const keyInfo = await nosskey.createNostrKey(credentialId, {
  username: 'alice'
});

// Set as current key info
nosskey.setCurrentKeyInfo(keyInfo);

// Sign event
const event = {
  kind: 1,
  content: 'Hello, Nostr!',
  tags: []
};

const signedEvent = await nosskey.signEvent(event);
console.log('Signed event:', signedEvent);
```

### Usage with Cache Enabled

```typescript
const nosskey = new NosskeyManager({
  cacheOptions: {
    enabled: true,
    timeoutMs: 10 * 60 * 1000 // 10 minutes
  }
});

// First signing (passkey authentication required)
const signedEvent1 = await nosskey.signEvent(event1);

// Second signing (retrieved from cache, no authentication required)
const signedEvent2 = await nosskey.signEvent(event2);
```

## Security Benefits

1. **No persistent private key storage**: Private keys are generated temporarily only during signing and immediately cleared from memory after use
2. **No relay dependency**: No need to store encrypted private keys on relays
3. **Easy restoration**: Same Nostr keys can be restored from any device with the same passkey
4. **Reduced leakage risk**: Significantly reduced risk of data leakage as no persistent private key data exists
5. **Standardized salt value**: Compatibility ensured through unified salt values across implementations

## Important Notes

| Item | Description |
|------|-------------|
| PRF Extension Support | Not all authenticators support PRF extension. Check with `isPrfSupported()` before use. |
| Memory Clearance | Web Crypto buffers are detached by garbage collection, but explicit fill(0) for Uint8Arrays should still be done carefully. |
| PRF Value Validity | When using PRF values directly as secret keys, there is a possibility (albeit extremely low) that they may not fall within the valid range of secp256k1. |
| Cross-device Sync | Passkey cloud sync functionality enables automatic account availability across multiple devices. |
