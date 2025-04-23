/**
 * Nosskey class for Passkey-Derived Nostr Identity
 * @packageDocumentation
 */

import { NosskeyOptions, NosskeyDerivedKey } from './types'

/**
 * Nosskey class for managing Passkey-Derived Nostr Identity
 */
export class Nosskey {
  private options: NosskeyOptions

  /**
   * Creates a new Nosskey instance
   * @param options - Configuration options
   */
  constructor(options: NosskeyOptions) {
    this.options = options
  }

  /**
   * Derive a nostr key pair using the registered passkey.
   * Prompts the user for biometric/passkey verification.
   * @returns Promise resolving to the derived key pair
   */
  async deriveKey(): Promise<NosskeyDerivedKey> {
    const challenge = await Nosskey.generateChallenge(
      this.options.userId,
      this.options.appNamespace,
      this.options.salt
    )

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [],
        userVerification: 'required',
        ...this.options.webAuthnOptions,
      },
    }) as PublicKeyCredential

    if (!credential.response) {
      throw new Error('No response from credential')
    }

    const response = credential.response as AuthenticatorAssertionResponse
    const signature = new Uint8Array(response.signature)
    const credentialId = new Uint8Array(credential.rawId)

    return Nosskey.deriveKeyFromSignature(signature)
  }

  /**
   * Utility: Create deterministic challenge buffer from userId + namespace + salt.
   * @param userId - User identifier
   * @param namespace - App namespace
   * @param salt - Optional salt
   * @returns Promise resolving to the challenge buffer
   */
  static async generateChallenge(
    userId: string,
    namespace: string,
    salt?: string
  ): Promise<Uint8Array> {
    const encoder = new TextEncoder()
    const data = encoder.encode(`${userId}:${namespace}${salt ? `:${salt}` : ''}`)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(hash)
  }

  /**
   * Utility: Import an existing raw signature and derive nostr keys.
   * @param signature - Raw signature from WebAuthn
   * @returns Derived key pair
   */
  static deriveKeyFromSignature(signature: Uint8Array): NosskeyDerivedKey {
    // TODO: Implement actual key derivation
    // This is a placeholder implementation
    return {
      sk: signature.slice(0, 32),
      pk: signature.slice(32, 64),
      credentialId: new Uint8Array(32),
      rawSignature: signature,
    }
  }

  /**
   * Utility: Convert nostr keys to hex string.
   * @param buf - Buffer to convert
   * @returns Hex string
   */
  static toHex(buf: Uint8Array): string {
    return Array.from(buf)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
} 