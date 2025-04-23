NIP: TBD Title: Passkey-Derived Nostr Identity (PDNI) Author: Anonymous Status: Draft Created: 2025-04-23

== Abstract ==

This NIP proposes a method to deterministically generate a nostr key pair from a WebAuthn-compatible Passkey signature, enabling users to authenticate and derive their private key without storing or exporting it. This design prioritizes user privacy, security, and a passwordless onboarding experience.

== Motivation ==

Current nostr clients rely on explicit management of private keys (e.g., saving a seed or mnemonic). This results in a poor user experience and potential security risks due to:

User mishandling of private keys

Loss of seed leading to account loss

Key theft through phishing or malware


With Passkey-supported devices becoming ubiquitous, there is a clear opportunity to improve nostr UX by leveraging existing secure hardware-backed credentials (e.g., Secure Enclave, TPM).

== Specification ==

=== Identity Derivation Process ===

1. The client requests a Passkey signature using WebAuthn APIs, with a deterministic challenge derived from the user ID and app namespace:



const challenge = SHA256("user@example.com@myapp.com");

2. The user signs this challenge via WebAuthn (biometric prompt, PIN, etc.).


3. The returned signature is hashed via SHA-256, and the first 32 bytes are used as the ed25519 private key (in nostr's format):



const nostrSk = SHA256(signature).slice(0, 32);

4. The corresponding public key is computed per usual nostr methods.



=== Constraints ===

The challenge string MUST be deterministic and namespace-isolated (to avoid cross-app collisions).

The signature MUST be derived from the same credential ID (i.e., Passkey instance) across sessions.

Clients SHOULD persist the credential ID for future logins.


== Security Considerations ==

The private key is never stored or exported—only re-derived via secure signature.

If the Passkey is lost or deleted, the nostr identity becomes irrecoverable.

Signature variability across authenticators or platforms may break determinism—developers MUST test across major platforms (Android/iOS/macOS/Windows).

Challenge derivation SHOULD use user identifiers that are stable but not globally unique (e.g., email + domain).


== Reference Implementation ==

A TypeScript implementation is available at: https://github.com/example/pdni-sdk (TBD)

== Backward Compatibility ==

This NIP is additive and does not conflict with existing nostr key handling.

== Copyright ==

This document is released under the public domain.

