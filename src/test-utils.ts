/**
 * Test utilities for Nosskey SDK
 * @packageDocumentation
 */

/**
 * Helper for testing/debugging
 * @param userId - User identifier
 * @returns Promise resolving to the dummy credential
 */
export async function registerDummyPasskey(userId: string): Promise<PublicKeyCredential> {
  // Create a dummy credential for testing
  const credential = {
    id: 'dummy-credential-id',
    rawId: new Uint8Array(32),
    type: 'public-key',
    response: {
      clientDataJSON: new Uint8Array(0),
      attestationObject: new Uint8Array(0),
      getAuthenticatorData: () => new Uint8Array(0),
      getPublicKey: () => new Uint8Array(0),
      getPublicKeyAlgorithm: () => -7,
      getTransports: () => ['internal'],
    },
  } as unknown as PublicKeyCredential

  return credential
} 