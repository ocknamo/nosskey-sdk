// Nosskey SDK - TypeScript Interface Design // Passkey-Derived Nostr Identity

export interface NosskeyOptions { /** Stable user identifier (e.g., username) / userId: string; /* App namespace to isolate derived keys / appNamespace: string; /* Optional salt to further scope the derivation / salt?: string; /* WebAuthn options override */ webAuthnOptions?: CredentialRequestOptions; }

export interface NosskeyDerivedKey { /** 32-byte nostr private key / sk: Uint8Array; /* 32-byte nostr public key / pk: Uint8Array; /* WebAuthn credential ID used for the signature / credentialId: Uint8Array; /* WebAuthn raw signature for audit/debug */ rawSignature: Uint8Array; }

export class Nosskey { private options: NosskeyOptions;

constructor(options: NosskeyOptions) { this.options = options; }

/**

Derive a nostr key pair using the registered passkey.

Prompts the user for biometric/passkey verification. */ async deriveKey(): Promise<NosskeyDerivedKey> { const challenge = await Nosskey.generateChallenge( this.options.userId, this.options.appNamespace, this.options.salt );


const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
  challenge,
  allowCredentials: undefined,
  timeout: 60000,
  userVerification: "preferred",
  ...this.options.webAuthnOptions,
};

const assertion = (await navigator.credentials.get({
  publicKey: publicKeyCredentialRequestOptions,
})) as PublicKeyCredential;

const response = assertion.response as AuthenticatorAssertionResponse;
const rawSignature = new Uint8Array(response.signature);
const credentialId = new Uint8Array(assertion.rawId);

const hashBuffer = await crypto.subtle.digest("SHA-256", rawSignature);
const sk = new Uint8Array(hashBuffer).slice(0, 32);

// Using tweetnacl or similar lib to compute public key
const nacl = await import("tweetnacl");
const pk = nacl.sign.keyPair.fromSeed(sk).publicKey;

return { sk, pk, credentialId, rawSignature };

}

/**

Utility: Create deterministic challenge buffer from userId + namespace + salt. */ static async generateChallenge(userId: string, namespace: string, salt?: string): Promise<Uint8Array> { const encoder = new TextEncoder(); const base = ${userId}@${namespace}${salt ? ":" + salt : ""}; const hash = await crypto.subtle.digest("SHA-256", encoder.encode(base)); return new Uint8Array(hash); }


/**

Utility: Import an existing raw signature and derive nostr keys. */ static deriveKeyFromSignature(signature: Uint8Array): NosskeyDerivedKey { const hash = new Uint8Array( Array.from(signature).length === 64 ? signature : new Uint8Array(crypto.subtle.digestSync("SHA-256", signature)) ); const sk = hash.slice(0, 32); const nacl = require("tweetnacl"); const pk = nacl.sign.keyPair.fromSeed(sk).publicKey; return { sk, pk, credentialId: new Uint8Array(), rawSignature: signature, }; }


/**

Utility: Convert nostr keys to hex string. */ static toHex(buf: Uint8Array): string { return Array.from(buf) .map((b) => b.toString(16).padStart(2, "0")) .join(""); } }


// Optional helper for testing/debugging export function registerDummyPasskey(userId: string): Promise<PublicKeyCredential> { // Stub only - actual registration flow would require user gesture and HTTPS context return Promise.reject("Not implemented in SDK - implement in app context"); }

