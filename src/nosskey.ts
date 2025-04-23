/**
 * Nosskey class for Passkey-Derived Nostr Identity
 * @packageDocumentation
 */

import { NosskeyOptions, NosskeyDerivedKey } from './types'
import { getPublicKey } from 'rx-nostr-crypto'

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
    this.options = {
      ...options,
      salt: options.salt ?? 'nosskey-v1'
    }
  }

  /**
   * Registers a new passkey for a user (Signup flow)
   * @param options - Registration options
   * @returns Promise resolving to registration result
   */
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

  /**
   * Derive a nostr key pair using the registered passkey.
   * Prompts the user for biometric/passkey verification.
   * @returns Promise resolving to the derived key pair
   */
  async deriveKey(): Promise<NosskeyDerivedKey> {
    const challenge = await Nosskey.deriveChallenge(
      this.options.userId,
      this.options.appNamespace,
      this.options.salt
    )

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: undefined,
      timeout: 60000,
      userVerification: "required",
      ...this.options.webAuthnOptions,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential;

    if (!assertion.response) {
      throw new Error('No response from credential')
    }

    const response = assertion.response as AuthenticatorAssertionResponse
    const rawSignature = new Uint8Array(response.signature)
    const credentialId = new Uint8Array(assertion.rawId)

    // Derive key pair using the common method
    const { sk, pk } = await this.deriveKeyFromSignature(rawSignature)

    return { sk, pk, credentialId }
  }

  /**
   * Utility: Create a deterministic challenge buffer from userId + namespace + salt.
   * The same input will always produce the same output.
   * @param userId - User identifier
   * @param namespace - App namespace
   * @param salt - Optional salt
   * @returns Promise resolving to the challenge buffer
   */
  static async deriveChallenge(
    userId: string,
    namespace: string,
    salt?: string
  ): Promise<Uint8Array> {
    const encoder = new TextEncoder()
    const base = `${userId}@${namespace}${salt ? ":" + salt : ""}`
    const hash = await crypto.subtle.digest("SHA-256", encoder.encode(base))
    return new Uint8Array(hash)
  }

  /**
   * Internal utility: Import an existing raw signature and derive nostr keys.
   * @param signature - Raw signature from WebAuthn
   * @returns Derived key pair
   * @private
   */
  private async deriveKeyFromSignature(signature: Uint8Array): Promise<{ sk: Uint8Array; pk: Uint8Array }> {
    const hash = new Uint8Array(
      Array.from(signature).length === 64
        ? signature
        : await crypto.subtle.digest("SHA-256", signature)
    )
    const sk = hash.slice(0, 32)
    
    // Convert private key to hex string and compute public key using rx-nostr-crypto
    const skHex = Nosskey.toHex(sk)
    const pkHex = getPublicKey(skHex)
    
    // Convert hex strings back to Uint8Array
    const pk = new Uint8Array(pkHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)))

    return { sk, pk }
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

  /**
   * Checks if the browser supports Passkey
   * @returns Promise resolving to boolean indicating if Passkey is supported
   */
  static async isPasskeySupported(): Promise<boolean> {
    if (
      typeof window === 'undefined' ||
      typeof window.PublicKeyCredential === 'undefined' ||
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
    ) {
      return false
    }

    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch {
      return false
    }
  }
} 