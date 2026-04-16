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
  const dummySignature = new Uint8Array(64);
  // Fill with some non-zero values for testing
  for (let i = 0; i < dummySignature.length; i++) {
    dummySignature[i] = (i + 1) % 256;
  }

  const dummyId = new Uint8Array(32);
  for (let i = 0; i < dummyId.length; i++) {
    dummyId[i] = (i + 1) % 256;
  }

  const credential = {
    id: 'dummy-credential-id',
    rawId: dummyId,
    type: 'public-key',
    response: {
      clientDataJSON: new Uint8Array(0),
      attestationObject: new Uint8Array(0),
      signature: dummySignature,
      authenticatorData: new Uint8Array(0),
      getAuthenticatorData: () => new Uint8Array(0),
      getPublicKey: () => new Uint8Array(0),
      getPublicKeyAlgorithm: () => -7,
      getTransports: () => ['internal'],
    },
  } as unknown as PublicKeyCredential;

  return credential;
}
