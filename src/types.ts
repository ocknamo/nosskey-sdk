/**
 * Type definitions for Nosskey SDK
 * @packageDocumentation
 */

/**
 * Options for Nosskey instance
 */
export interface NosskeyOptions {
  /** Stable user identifier (e.g., email) */
  userId: string
  /** App namespace to isolate derived keys */
  appNamespace: string
  /** Optional salt to further scope the derivation */
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
  /** WebAuthn raw signature for audit/debug */
  rawSignature: Uint8Array
}

export interface NosskeyConfig {
  // TODO: Add configuration options
}

export interface NosskeyIdentity {
  // TODO: Add identity properties
} 