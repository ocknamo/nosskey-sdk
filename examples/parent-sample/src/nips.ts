/**
 * NIP-04/44 operations and the NIP-04 send-DM flow.
 *
 * All functions accept a `NostrProvider` (the iframe-backed window.nostr-shape)
 * and a `Logger` as injected dependencies. They never touch the DOM and never
 * reach for `window.nostr` themselves — that keeps them testable with vi.fn()
 * mocks (see nips.spec.ts).
 */
import { NosskeyIframeError } from 'nosskey-iframe';
import type { NostrEvent } from 'nosskey-sdk';
import type { Logger } from './ui.js';

export interface NostrProvider {
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<NostrEvent>;
  getRelays(): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip44: {
    encrypt(peerPubkey: string, plaintext: string): Promise<string>;
    decrypt(peerPubkey: string, ciphertext: string): Promise<string>;
  };
  nip04: {
    encrypt(peerPubkey: string, plaintext: string): Promise<string>;
    decrypt(peerPubkey: string, ciphertext: string): Promise<string>;
  };
}

export function formatError(err: unknown): string {
  if (err instanceof NosskeyIframeError) {
    return `NosskeyIframeError[${err.code}]: ${err.message}`;
  }
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

export type DecryptResult = { ok: true; plaintext: string } | { ok: false; message: string };

export interface EncryptInputs {
  nostr: NostrProvider;
  peer: string;
  plaintext: string;
  log: Logger;
}

export interface DecryptInputs {
  nostr: NostrProvider;
  peer: string;
  ciphertext: string;
  log: Logger;
}

export async function nip44Encrypt(inputs: EncryptInputs): Promise<string | null> {
  const { nostr, peer, plaintext, log } = inputs;
  log(`Requesting window.nostr.nip44.encrypt() for ${plaintext.length} chars…`);
  try {
    const ciphertext = await nostr.nip44.encrypt(peer, plaintext);
    log(`NIP-44 encrypt OK (${ciphertext.length} chars of base64).`);
    return ciphertext;
  } catch (err) {
    log(`NIP-44 encrypt failed: ${formatError(err)}`);
    return null;
  }
}

export async function nip44Decrypt(inputs: DecryptInputs): Promise<DecryptResult> {
  const { nostr, peer, ciphertext, log } = inputs;
  log('Requesting window.nostr.nip44.decrypt()…');
  try {
    const plaintext = await nostr.nip44.decrypt(peer, ciphertext);
    log(`NIP-44 decrypt OK (${plaintext.length} chars).`);
    return { ok: true, plaintext };
  } catch (err) {
    const message = formatError(err);
    log(`NIP-44 decrypt failed: ${message}`);
    return { ok: false, message };
  }
}

export async function nip04Encrypt(inputs: EncryptInputs): Promise<string | null> {
  const { nostr, peer, plaintext, log } = inputs;
  log(`Requesting window.nostr.nip04.encrypt() for ${plaintext.length} chars…`);
  try {
    const ciphertext = await nostr.nip04.encrypt(peer, plaintext);
    log(`NIP-04 encrypt OK (${ciphertext.length} chars).`);
    return ciphertext;
  } catch (err) {
    log(`NIP-04 encrypt failed: ${formatError(err)}`);
    return null;
  }
}

export async function nip04Decrypt(inputs: DecryptInputs): Promise<DecryptResult> {
  const { nostr, peer, ciphertext, log } = inputs;
  log('Requesting window.nostr.nip04.decrypt()…');
  try {
    const plaintext = await nostr.nip04.decrypt(peer, ciphertext);
    log(`NIP-04 decrypt OK (${plaintext.length} chars).`);
    return { ok: true, plaintext };
  } catch (err) {
    const message = formatError(err);
    log(`NIP-04 decrypt failed: ${message}`);
    return { ok: false, message };
  }
}

export interface SignAndPublishInputs {
  nostr: NostrProvider;
  content: string;
  relayUrl: string;
  log: Logger;
  publish: (event: NostrEvent) => Promise<void>;
}

export async function signAndPublishNote(inputs: SignAndPublishInputs): Promise<void> {
  const { nostr, content, log, publish } = inputs;
  const draft: NostrEvent = {
    kind: 1,
    content,
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
  };

  log('Requesting window.nostr.signEvent() for kind:1 note…');
  let signed: NostrEvent;
  try {
    signed = await nostr.signEvent(draft);
  } catch (err) {
    log(`signEvent failed: ${formatError(err)}`);
    return;
  }
  log(`Signed event: ${JSON.stringify(signed, null, 2)}`);

  try {
    await publish(signed);
  } catch (err) {
    log(`Publish failed: ${formatError(err)}`);
  }
}

export interface Nip04SendDmInputs {
  nostr: NostrProvider;
  peer: string;
  plaintext: string;
  log: Logger;
  publish: (event: NostrEvent) => Promise<void>;
  /** Called with the encrypted ciphertext so the UI can mirror it (optional). */
  onCiphertext?: (ciphertext: string) => void;
}

export async function nip04SendDm(inputs: Nip04SendDmInputs): Promise<void> {
  const { nostr, peer, plaintext, log, publish, onCiphertext } = inputs;

  log(`NIP-04 DM: encrypting to ${peer.slice(0, 8)}…`);
  const ciphertext = await nip04Encrypt({ nostr, peer, plaintext, log });
  if (ciphertext === null) return;
  onCiphertext?.(ciphertext);

  const draft: NostrEvent = {
    kind: 4,
    content: ciphertext,
    tags: [['p', peer]],
    created_at: Math.floor(Date.now() / 1000),
  };
  log('NIP-04 DM: signing kind:4 event…');
  let signed: NostrEvent;
  try {
    signed = await nostr.signEvent(draft);
  } catch (err) {
    log(`NIP-04 DM signEvent failed: ${formatError(err)}`);
    return;
  }
  log(`NIP-04 DM: signed event id ${signed.id ?? '(missing id)'}.`);

  try {
    await publish(signed);
  } catch (err) {
    log(`NIP-04 DM publish failed: ${formatError(err)}`);
  }
}
