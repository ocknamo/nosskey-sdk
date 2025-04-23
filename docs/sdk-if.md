// Nosskey SDK - TypeScript Interface Design // Passkey-Derived Nostr Identity

export interface NosskeyOptions { /** Stable user identifier (e.g., email) / userId: string; /* App namespace to isolate derived keys / appNamespace: string; /* Optional salt to further scope the derivation / salt?: string; /* WebAuthn options override */ webAuthnOptions?: CredentialRequestOptions; }

export interface NosskeyDerivedKey { /** 32-byte nostr private key / sk: Uint8Array; /* 32-byte nostr public key / pk: Uint8Array; /* WebAuthn credential ID used for the signature / credentialId: Uint8Array; /* WebAuthn raw signature for audit/debug */ rawSignature: Uint8Array; }

export class Nosskey { constructor(options: NosskeyOptions);

/**

Derive a nostr key pair using the registered passkey.

Prompts the user for biometric/passkey verification. */ deriveKey(): Promise<NosskeyDerivedKey>;


/**

Utility: Create deterministic challenge buffer from userId + namespace + salt. */ static generateChallenge(userId: string, namespace: string, salt?: string): Promise<Uint8Array>;


/**

Utility: Import an existing raw signature and derive nostr keys. */ static deriveKeyFromSignature(signature: Uint8Array): NosskeyDerivedKey;


/**

Utility: Convert nostr keys to hex string. */ static toHex(buf: Uint8Array): string; }


// Optional helper for testing/debugging export function registerDummyPasskey(userId: string): Promise<PublicKeyCredential>;

