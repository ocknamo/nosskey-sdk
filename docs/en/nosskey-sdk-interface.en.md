# Nosskey SDK Interface Specification (English)

## Overview

Nosskey SDK adopts a method that directly derives Nostr private keys using the PRF extension of WebAuthn passkeys. The PWKBlob concept has been abolished in favor of a simpler and more secure NostrKeyInfo structure.

## Main Type Definitions

### NostrKeyInfo

```typescript
/**
 * Nostr key information
 * Two modes are distinguished by the presence/absence of the `wrapped` field:
 *  - wrapped === undefined: PRF direct mode (PRF output is used as the Nostr private key)
 *  - wrapped is set: wrap mode (nsec is NIP-44 v2 encrypted with a PRF-derived KEK)
 */
export interface NostrKeyInfo {
  credentialId: string; // Credential ID stored in hex format
  pubkey: string; // Public key (hex format). In wrap mode this is the user's Nostr public key (the *imported* key, not KEK·G).
  salt: string; // Salt used as the PRF evaluation input (hex format). PRF direct mode: "6e6f7374722d70776b" / wrap mode: "6e6f7374722d70776b2d77726170"
  username?: string; // Username when creating passkey (only if available)
  /**
   * Wrap-mode metadata.
   * When set, the key is stored in wrap mode (nsec encrypted with a PRF-derived KEK using NIP-44 v2).
   */
  wrapped?: {
    v: 1; // Data format version
    alg: 'nip44-v2'; // Encryption algorithm identifier
    payload: string; // The return value of nip44Encrypt (base64-encoded NIP-44 v2 payload)
  };
}
```

`signEvent` / `nip44Encrypt` / `nip44Decrypt` / `nip04Encrypt` / `nip04Decrypt` / `exportNostrKey` transparently handle both modes by branching on the `wrapped` field internally, so callers don't need to distinguish modes.

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
  prfOptions?: GetPrfSecretOptions;
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

### NIP-44 / NIP-04 Encryption Methods

Derives a shared key from the private key of the currently set NostrKeyInfo and a peer's public key to encrypt/decrypt direct messages.

#### nip44Encrypt()
Encrypts plaintext with NIP-44 v2.

```typescript
async nip44Encrypt(peerPubkey: string, plaintext: string): Promise<string>
```

#### nip44Decrypt()
Decrypts a NIP-44 v2 payload.

```typescript
async nip44Decrypt(peerPubkey: string, ciphertext: string): Promise<string>
```

#### nip04Encrypt()
Encrypts plaintext with NIP-04 (legacy method).

```typescript
async nip04Encrypt(peerPubkey: string, plaintext: string): Promise<string>
```

#### nip04Decrypt()
Decrypts a NIP-04 payload.

```typescript
async nip04Decrypt(peerPubkey: string, ciphertext: string): Promise<string>
```

### NostrKeyInfo Management Methods

#### setCurrentKeyInfo()
Sets the current NostrKeyInfo. When storage is enabled it is saved to the current
slot, and (when the registry is enabled) the entry is also upserted into the
multi-account registry, keyed by `pubkey + credentialId`. As a result, setting a
second account no longer destroys the first account's `wrapped.payload`.

```typescript
setCurrentKeyInfo(keyInfo: NostrKeyInfo): void
```

> ⚠️ **Wrap mode is asymmetric.** A wrapped key's `wrapped.payload` is the only copy of
> the imported nsec and cannot be re-derived from the passkey (unlike PRF direct mode).
> The registry protects it from being overwritten, but if the registry is disabled it is
> lost on overwrite. Keep a backup of the original nsec.

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
**Completely wipes** the stored key material: the current slot, the multi-account
registry, the in-memory state, and the derived-key cache. This is a destructive
operation that deletes all secrets (including wrap-mode encrypted nsec). Use it for a
full sign-out on a shared device. For logout (keeping the ability to log back in), use
`clearCurrentKeyInfo()` instead.

```typescript
clearStoredKeyInfo(): void
```

> ⚠️ Wrap-mode keys are **unrecoverable** after this call. Back up the original nsec
> beforehand if you may need it.

#### clearCurrentKeyInfo()
Logout helper: clears only the current pointer (single slot), the in-memory state, and
the derived-key cache. The registry is preserved, so saved accounts — especially
unrecoverable wrap-mode keys — remain available for re-login.

```typescript
clearCurrentKeyInfo(): void
```

#### listKeyInfos()
Returns a deep copy of every NostrKeyInfo stored in the registry. Returns an empty
array when the registry is disabled.

```typescript
listKeyInfos(): NostrKeyInfo[]
```

#### removeKeyInfo()
Removes the matching account (`pubkey + credentialId`) from the registry. Removing a
wrap-mode entry makes its encrypted nsec unrecoverable.

```typescript
removeKeyInfo(pubkey: string, credentialId: string): void
```

#### backupKeyInfo()
Returns a **deep copy** of a NostrKeyInfo (including `wrapped.payload`) for backup.
With no arguments it returns the current key; with a `pubkey` (and optionally a
`credentialId`) it returns the matching registry entry, or `null` if none. Mutating the
returned value does not affect internal state.

```typescript
backupKeyInfo(pubkey?: string, credentialId?: string): NostrKeyInfo | null
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
Creates NostrKeyInfo using PRF value directly as Nostr secret key (PRF direct mode).

```typescript
async createNostrKey(
  credentialId?: Uint8Array,
  options?: KeyOptions
): Promise<NostrKeyInfo>
```

#### importNostrKey()
Imports an existing Nostr private key (32-byte raw nsec) and stores it encrypted by a PRF-derived KEK using NIP-44 v2 (wrap mode). The encrypted payload is produced by the self-DM pattern (`ourSk = KEK`, `peerPk = KEK·G`) and saved in `NostrKeyInfo.wrapped.payload`.

```typescript
async importNostrKey(
  seckey: Uint8Array,
  credentialId?: Uint8Array,
  options?: KeyOptions
): Promise<NostrKeyInfo>
```

Validation rules:
- `seckey` must be a 32-byte `Uint8Array` (otherwise throws).
- An all-zero `seckey` is rejected (invalid key).
- An all-zero PRF output (KEK) is also rejected (extremely rare).

Security notes:
- The input `seckey` buffer (`Uint8Array`) is zeroed (`.fill(0)`) inside the SDK on completion. Callers are still encouraged to zero their own buffers before and after.
- Once you call `setCurrentKeyInfo()` with the returned `NostrKeyInfo`, subsequent `signEvent` / `nip44Encrypt` / `nip44Decrypt` / `nip04Encrypt` / `nip04Decrypt` / `exportNostrKey` operate transparently in wrap mode (API is identical to PRF direct mode).
- **Wrap keys are unrecoverable / asymmetric vs. PRF direct mode**: the returned `wrapped.payload` is the only copy of the imported nsec and cannot be re-derived from the passkey. With the registry enabled (default), `setCurrentKeyInfo()` preserves it across current-slot overwrites, and logout via `clearCurrentKeyInfo()` keeps it. However it is **permanently lost** via `clearStoredKeyInfo()` (full wipe), `removeKeyInfo()`, or when `registryEnabled` is `false`. Keep a backup of the original nsec, and use `backupKeyInfo()` to export the `NostrKeyInfo` (including `wrapped.payload`).
- **Memory zeroing limitation**: The SDK internally hex-encodes the private key (`string`) when handing it to `seckeySigner` or routing it through the NIP-44 plaintext path. JavaScript `string` primitives are immutable and lack any write-back API, so an equivalent of `Uint8Array.fill(0)` is not possible — those hex strings **remain on the heap until garbage collection**. This applies to `importNostrKey`, `exportNostrKey`, and post-decrypt `signEvent` paths. If your threat model includes attackers with direct browser-heap access, take this caveat into account.

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

#### clearPendingPrf()
Zeroizes and discards the unconsumed PRF cache stashed by `createPasskey()` (the direct-mode secret key / wrap-mode KEK).

```typescript
clearPendingPrf(credentialId?: Uint8Array | string): void
```

- `createPasskey()` evaluates the standard-salt and wrap-salt PRFs with a single UV and keeps them in an internal cache until the subsequent `createNostrKey()` / `importNostrKey()` consumes them.
- Unconsumed entries are automatically zeroized after a TTL (`PENDING_PRF_TTL_MS` = 60 seconds), but if your flow is cancelled or bails out with an error after `createPasskey()` — i.e. you know the cache will never be consumed — you can clear it immediately with this method.
- Omitting `credentialId` discards all entries. It is also called automatically from `clearCurrentKeyInfo()` (logout) and `clearStoredKeyInfo()` (full wipe).
- If key derivation is needed after discarding, UV (passkey authentication) is requested via `getPrfSecret()` as usual.

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
  storageKey?: string; // Key name for the current slot (default: "nosskey_keyinfo")
  registryEnabled?: boolean; // Whether to enable the multi-account registry (default: true)
  registryStorageKey?: string; // Key name for the registry (default: "nosskey_accounts")
}
```

When `registryEnabled` is true (the default), `setCurrentKeyInfo()` also upserts the
entry into the registry stored under `registryStorageKey` (a key separate from
`storageKey`). This prevents wrap-mode keys from being lost on overwrite or logout. Set
it to `false` to fully opt out of the registry (legacy single-slot behavior).

### GetPrfSecretOptions

```typescript
export interface GetPrfSecretOptions {
  rpId?: string; // Relying Party ID
  timeout?: number; // Timeout duration (milliseconds)
  userVerification?: UserVerificationRequirement; // User verification requirement
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

## Package Exports

In addition to the `NosskeyManager` class and type definitions, the `nosskey-sdk` entry point (barrel) exposes the following standalone functions.

### Low-level NIP-44 Functions

Unlike the `NosskeyManager` methods such as `nip44Encrypt()`, which manage the private key internally, these standalone functions take the private key (`Uint8Array`) directly as an argument. **Note that they share the method names but have different signatures.** Use them when you need to encrypt with an ephemeral private key rather than the registered passkey-derived key (e.g. NIP-17 gift-wrap).

```typescript
function nip44Encrypt(
  plaintext: string,
  ourSecretKey: Uint8Array,
  peerPubkeyHex: string,
  nonceOverride?: Uint8Array
): string

function nip44Decrypt(payload: string, ourSecretKey: Uint8Array, peerPubkeyHex: string): string
```

The low-level NIP-04 functions are not exported. For NIP-04 encryption/decryption, use the `NosskeyManager` `nip04Encrypt()` / `nip04Decrypt()` methods.

### PRF Handler Functions

The `NosskeyManager` `isPrfSupported()` / `createPasskey()` methods use these internally. They can also be used directly.

```typescript
function isPrfSupported(): Promise<boolean>

function createPasskey(options?: PasskeyCreationOptions): Promise<Uint8Array>

function getPrfSecret(
  credentialId?: Uint8Array,
  options?: GetPrfSecretOptions,
  salt?: Uint8Array // PRF evaluation input; defaults to the standard value "nostr-pwk"
): Promise<{ secret: Uint8Array; id: Uint8Array }>
```

### Byte Conversion Utilities

```typescript
function bytesToHex(bytes: Uint8Array): string

function hexToBytes(hex: string): Uint8Array
```

### Test Utility

```typescript
function registerDummyPasskey(userId: string): Promise<PublicKeyCredential>
```

A helper for registering a dummy passkey, intended for testing and demos. It is not intended for use in production code.

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
