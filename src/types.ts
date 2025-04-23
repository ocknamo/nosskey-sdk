/**
 * Type definitions for Nosskey SDK
 * @packageDocumentation
 */

/**
 * Options for Nosskey instance
 */
export interface NosskeyOptions {
  /** Stable user identifier (e.g., username) */
  userId: string
  /** App namespace to isolate derived keys. e.g. window.location.hostname */
  appNamespace: string
  /** Optional salt to further scope the derivation. e.g. nosskey-v1 */
  salt?: string
  /** WebAuthn options override */
  webAuthnOptions?: CredentialRequestOptions
}

/**
 * Derived key pair for Nostr
 */
export interface NosskeyDerivedKey {
  /** 32-byte nostr private key */
  sk: Uint8Array
  /** 32-byte nostr public key */
  pk: Uint8Array
  /** WebAuthn credential ID used for the signature */
  credentialId: Uint8Array
}
