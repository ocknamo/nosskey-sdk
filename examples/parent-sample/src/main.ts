import { NosskeyIframeClient, NosskeyIframeError } from 'nosskey-iframe';
import type { NostrEvent } from 'nosskey-sdk';
import { sendNip17Dm } from './nip17.js';
import {
  type NostrProvider,
  formatError,
  nip04Decrypt,
  nip04Encrypt,
  nip04SendDm,
  nip44Decrypt,
  nip44Encrypt,
  signAndPublishNote,
} from './nips.js';
import { publishToRelays, resolvePublishRelays } from './relay.js';
import { createToaster } from './toast.js';
import {
  type LangChoice,
  type ThemeChoice,
  applyParentTheme,
  clearParentTheme,
  createLogger,
  installModalVisibilityListener,
  queryUiElements,
  requireEl,
  resolveTheme,
  setConnectedUI,
  setModalVisible,
  setStatus,
} from './ui.js';
import { parsePeerPubkey, parseRelayUrl } from './validation.js';

declare global {
  interface Window {
    nostr?: NostrProvider;
  }
}

const app = requireEl<HTMLDivElement>(document, '#app');
const modal = requireEl<HTMLDivElement>(document, '#iframe-modal');
const modalCard = requireEl<HTMLDivElement>(modal, '.iframe-modal__card');
const toastContainer = requireEl<HTMLDivElement>(document, '#toast-container');

const ui = queryUiElements(app);
const log = createLogger(ui.log);
const toaster = createToaster(toastContainer);

installModalVisibilityListener(modal);

let client: NosskeyIframeClient | null = null;

/**
 * Resolve the publish targets — the write relays advertised by the iframe via
 * `getRelays()`, with the manually entered relay URL as a fallback — and
 * publish the signed event to all of them. Rejects only when no relay is
 * available or every relay rejected, so the calling action surfaces a failure.
 */
async function publish(
  nostr: NostrProvider,
  fallbackRelayUrl: string | null,
  event: NostrEvent
): Promise<void> {
  const relays = await resolvePublishRelays({
    getRelays: () => nostr.getRelays(),
    fallbackRelayUrl,
    log,
  });
  if (relays.length === 0) {
    throw new Error(
      'No relay to publish to: getRelays() returned none and the relay URL field is empty.'
    );
  }
  const { succeeded, failed } = await publishToRelays(relays, event, { log });
  for (const f of failed) {
    log(`Publish to ${f.url} failed: ${f.error}`);
  }
  if (succeeded.length === 0) {
    throw new Error(`Publish failed: all ${relays.length} relay(s) rejected or errored.`);
  }
  log(`Published to ${succeeded.length}/${relays.length} relay(s): ${succeeded.join(', ')}.`);
}

async function connect(): Promise<void> {
  const iframeUrl = ui.iframeUrl.value.trim();
  if (!iframeUrl) {
    log('Connect aborted: iframe URL is empty.');
    toaster.show('Connect aborted: iframe URL is empty.', 'error');
    return;
  }
  setStatus(ui.status, 'connecting…');
  const themeChoice = ui.parentTheme.value as ThemeChoice;
  const langChoice = ui.parentLang.value as LangChoice;
  log(`Mounting iframe ${iframeUrl} with theme=${themeChoice}, lang=${langChoice}`);
  applyParentTheme(resolveTheme(themeChoice));
  const progress = toaster.show('Connecting to iframe…', 'progress');
  let next: NosskeyIframeClient | null = null;
  try {
    next = new NosskeyIframeClient({ iframeUrl, theme: themeChoice, lang: langChoice });
    client = next;
    modalCard.appendChild(next.iframe);
    await next.ready();
    // If a concurrent re-mount (theme/lang change) swapped the active client
    // while we awaited ready(), bail out without touching shared UI state —
    // the newer connect() owns the `client` slot now.
    if (client !== next) {
      next.destroy();
      progress.dismiss();
      return;
    }
    window.nostr = {
      getPublicKey: () => next.getPublicKey(),
      signEvent: (event) => next.signEvent(event),
      getRelays: () => next.getRelays(),
      nip44: {
        encrypt: (peer, plain) => next.nip44.encrypt(peer, plain),
        decrypt: (peer, cipher) => next.nip44.decrypt(peer, cipher),
      },
      nip04: {
        encrypt: (peer, plain) => next.nip04.encrypt(peer, plain),
        decrypt: (peer, cipher) => next.nip04.decrypt(peer, cipher),
      },
    };
    setConnectedUI(ui, true);
    setStatus(ui.status, 'connected', 'ok');
    log('Received nosskey:ready. window.nostr is now available.');
    progress.settle('Connected. window.nostr is available.', 'success');
  } catch (err) {
    const error = formatError(err);
    log(`Connect failed: ${error}`);
    next?.destroy();
    // Only reset shared UI state — and surface the failure toast — if this
    // connect() still owns the client slot. A concurrent re-mount may have
    // already replaced us with a fresh, possibly-successful connect; we must
    // not overwrite its toast with our stale error.
    if (next === null || client === next) {
      client = null;
      window.nostr = undefined;
      setConnectedUI(ui, false);
      setModalVisible(modal, false);
      clearParentTheme();
      setStatus(ui.status, 'connect failed', 'err');
      progress.settle(`Connect failed: ${error}`, 'error');
    } else {
      progress.dismiss();
    }
  }
}

function disconnect(): void {
  if (!client) return;
  client.destroy();
  client = null;
  window.nostr = undefined;
  setConnectedUI(ui, false);
  setModalVisible(modal, false);
  clearParentTheme();
  setStatus(ui.status, 'disconnected');
  log('Iframe destroyed; window.nostr removed.');
  toaster.show('Disconnected.', 'info');
}

async function getPubkey(): Promise<void> {
  if (!window.nostr) return;
  log('Requesting window.nostr.getPublicKey()…');
  const progress = toaster.show('Fetching public key…', 'progress');
  try {
    const pubkey = await window.nostr.getPublicKey();
    log(`pubkey: ${pubkey}`);
    progress.settle(`Public key: ${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`, 'success');
  } catch (err) {
    const error = formatError(err);
    log(`getPublicKey failed: ${error}`);
    if (err instanceof NosskeyIframeError && err.code === 'NO_KEY') {
      log(
        'Hint: no key is registered for this iframe origin yet. Click ' +
          '"Grant storage access" / "Open setup" in the visible iframe above, ' +
          'then register or sign in with a passkey in the new tab. When you ' +
          'return to this tab the iframe re-checks storage on visibility — on ' +
          'Safari/iOS the key is read from a first-party cookie at the iframe ' +
          'origin, on Chromium/Firefox from the unpartitioned localStorage handle.'
      );
    }
    progress.settle(`getPublicKey failed: ${error}`, 'error');
  }
}

async function getRelays(): Promise<void> {
  if (!window.nostr) return;
  log('Requesting window.nostr.getRelays()…');
  const progress = toaster.show('Fetching relays…', 'progress');
  try {
    const relays = await window.nostr.getRelays();
    const count = Object.keys(relays).length;
    const formatted = count === 0 ? '{}' : JSON.stringify(relays, null, 2);
    ui.relaysOutput.textContent = formatted;
    log(`getRelays: ${count} relay(s) returned`);
    progress.settle(`getRelays: ${count} relay(s) returned`, 'success');
  } catch (err) {
    const message = formatError(err);
    log(`getRelays failed: ${message}`);
    ui.relaysOutput.textContent = `Error: ${message}`;
    progress.settle(`getRelays failed: ${message}`, 'error');
  }
}

async function signAndPublish(): Promise<void> {
  if (!window.nostr) return;
  const nostr = window.nostr;
  const relay = parseRelayUrl(ui.relayUrl.value);
  const fallbackRelayUrl = relay.ok ? relay.value : null;
  const progress = toaster.show('Signing & publishing…', 'progress');
  const result = await signAndPublishNote({
    nostr,
    content: ui.note.value,
    log,
    publish: (event) => publish(nostr, fallbackRelayUrl, event),
  });
  if (result.ok) {
    progress.settle('Note published.', 'success');
  } else {
    progress.settle(`Sign & publish failed: ${result.error}`, 'error');
  }
}

async function fillSelfPubkey(target: HTMLInputElement, label: string): Promise<void> {
  if (!window.nostr) return;
  log(`${label}: requesting window.nostr.getPublicKey() to self-fill peer pubkey…`);
  try {
    target.value = await window.nostr.getPublicKey();
    log(`${label}: peer pubkey set to own pubkey.`);
    toaster.show(`${label}: peer set to your pubkey.`, 'info');
  } catch (err) {
    const error = formatError(err);
    log(`${label}: getPublicKey failed: ${error}`);
    toaster.show(`${label}: getPublicKey failed: ${error}`, 'error');
  }
}

async function runNip44Encrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip44Peer.value);
  if (!peer.ok) {
    log(`NIP-44 encrypt aborted: ${peer.reason}.`);
    toaster.show(`NIP-44 encrypt aborted: ${peer.reason}`, 'error');
    return;
  }
  const progress = toaster.show('NIP-44 encrypting…', 'progress');
  const ciphertext = await nip44Encrypt({
    nostr: window.nostr,
    peer: peer.value,
    plaintext: ui.nip44Plaintext.value,
    log,
  });
  if (ciphertext !== null) {
    ui.nip44Ciphertext.value = ciphertext;
    progress.settle('NIP-44 encrypt OK.', 'success');
  } else {
    progress.settle('NIP-44 encrypt failed.', 'error');
  }
}

async function runNip44Decrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip44Peer.value);
  const ciphertext = ui.nip44Ciphertext.value.trim();
  if (!peer.ok || !ciphertext) {
    log('NIP-44 decrypt aborted: peer pubkey or ciphertext is empty.');
    toaster.show('NIP-44 decrypt aborted: peer pubkey or ciphertext is empty.', 'error');
    return;
  }
  const progress = toaster.show('NIP-44 decrypting…', 'progress');
  const result = await nip44Decrypt({
    nostr: window.nostr,
    peer: peer.value,
    ciphertext,
    log,
  });
  ui.nip44Decrypted.textContent = result.ok ? result.plaintext : `Error: ${result.message}`;
  if (result.ok) {
    progress.settle('NIP-44 decrypt OK.', 'success');
  } else {
    progress.settle(`NIP-44 decrypt failed: ${result.message}`, 'error');
  }
}

async function runNip04Encrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip04Peer.value);
  if (!peer.ok) {
    log(`NIP-04 encrypt aborted: ${peer.reason}.`);
    toaster.show(`NIP-04 encrypt aborted: ${peer.reason}`, 'error');
    return;
  }
  const progress = toaster.show('NIP-04 encrypting…', 'progress');
  const ciphertext = await nip04Encrypt({
    nostr: window.nostr,
    peer: peer.value,
    plaintext: ui.nip04Plaintext.value,
    log,
  });
  if (ciphertext !== null) {
    ui.nip04Ciphertext.value = ciphertext;
    progress.settle('NIP-04 encrypt OK.', 'success');
  } else {
    progress.settle('NIP-04 encrypt failed.', 'error');
  }
}

async function runNip04Decrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip04Peer.value);
  const ciphertext = ui.nip04Ciphertext.value.trim();
  if (!peer.ok || !ciphertext) {
    log('NIP-04 decrypt aborted: peer pubkey or ciphertext is empty.');
    toaster.show('NIP-04 decrypt aborted: peer pubkey or ciphertext is empty.', 'error');
    return;
  }
  const progress = toaster.show('NIP-04 decrypting…', 'progress');
  const result = await nip04Decrypt({
    nostr: window.nostr,
    peer: peer.value,
    ciphertext,
    log,
  });
  ui.nip04Decrypted.textContent = result.ok ? result.plaintext : `Error: ${result.message}`;
  if (result.ok) {
    progress.settle('NIP-04 decrypt OK.', 'success');
  } else {
    progress.settle(`NIP-04 decrypt failed: ${result.message}`, 'error');
  }
}

async function runNip04SendDm(): Promise<void> {
  if (!window.nostr) return;
  const nostr = window.nostr;
  const peer = parsePeerPubkey(ui.nip04Peer.value);
  if (!peer.ok) {
    log(`NIP-04 DM aborted: ${peer.reason}.`);
    toaster.show(`NIP-04 DM aborted: ${peer.reason}`, 'error');
    return;
  }
  const relay = parseRelayUrl(ui.relayUrl.value);
  const fallbackRelayUrl = relay.ok ? relay.value : null;
  const progress = toaster.show('NIP-04 DM: encrypting, signing & publishing…', 'progress');
  const result = await nip04SendDm({
    nostr,
    peer: peer.value,
    plaintext: ui.nip04Plaintext.value,
    log,
    publish: (event) => publish(nostr, fallbackRelayUrl, event),
    onCiphertext: (ciphertext) => {
      ui.nip04Ciphertext.value = ciphertext;
    },
  });
  if (result.ok) {
    progress.settle('NIP-04 DM published.', 'success');
  } else {
    progress.settle(`NIP-04 DM failed: ${result.error}`, 'error');
  }
}

async function runNip17SendDm(): Promise<void> {
  if (!window.nostr) return;
  const nostr = window.nostr;
  const peer = parsePeerPubkey(ui.nip17Peer.value);
  if (!peer.ok) {
    log(`NIP-17 DM aborted: ${peer.reason}.`);
    toaster.show(`NIP-17 DM aborted: ${peer.reason}`, 'error');
    return;
  }
  const relay = parseRelayUrl(ui.relayUrl.value);
  const fallbackRelayUrl = relay.ok ? relay.value : null;

  const progress = toaster.show('NIP-17 DM: sealing & publishing…', 'progress');
  log('NIP-17 DM: resolving sender pubkey…');
  let senderPubkey: string;
  try {
    senderPubkey = await nostr.getPublicKey();
  } catch (err) {
    const error = formatError(err);
    log(`NIP-17 DM getPublicKey failed: ${error}`);
    progress.settle(`NIP-17 DM failed: ${error}`, 'error');
    return;
  }

  log(`NIP-17 DM: sealing rumor for ${peer.value.slice(0, 8)}… (consent dialog x2)`);
  try {
    const result = await sendNip17Dm({
      senderPubkey,
      peerPubkey: peer.value,
      plaintext: ui.nip17Plaintext.value,
      sealEncrypt: (p, plain) => nostr.nip44.encrypt(p, plain),
      signSeal: (draft) => nostr.signEvent(draft),
      publish: (event) => publish(nostr, fallbackRelayUrl, event),
    });
    log(`NIP-17 DM: gift wrap id ${result.giftWrap.id ?? '(missing id)'}`);
    log(`NIP-17 DM: ephemeral pubkey ${result.ephemeralPubkey}`);
    progress.settle('NIP-17 DM published.', 'success');
  } catch (err) {
    const error = formatError(err);
    log(`NIP-17 DM failed: ${error}`);
    progress.settle(`NIP-17 DM failed: ${error}`, 'error');
  }
}

function remountIfConnected(reason: string): void {
  if (!client) return;
  log(`${reason}: re-mounting iframe…`);
  disconnect();
  void connect();
}

ui.connect.addEventListener('click', () => {
  void connect();
});
ui.disconnect.addEventListener('click', disconnect);
ui.parentTheme.addEventListener('change', () => {
  remountIfConnected(`Theme changed to ${ui.parentTheme.value}`);
});
ui.parentLang.addEventListener('change', () => {
  remountIfConnected(`Lang changed to ${ui.parentLang.value}`);
});
ui.getPubkey.addEventListener('click', () => {
  void getPubkey();
});
ui.getRelays.addEventListener('click', () => {
  void getRelays();
});
ui.signPublish.addEventListener('click', () => {
  void signAndPublish();
});
ui.nip44UseSelf.addEventListener('click', () => {
  void fillSelfPubkey(ui.nip44Peer, 'NIP-44');
});
ui.nip44Encrypt.addEventListener('click', () => {
  void runNip44Encrypt();
});
ui.nip44Decrypt.addEventListener('click', () => {
  void runNip44Decrypt();
});
ui.nip04UseSelf.addEventListener('click', () => {
  void fillSelfPubkey(ui.nip04Peer, 'NIP-04');
});
ui.nip04Encrypt.addEventListener('click', () => {
  void runNip04Encrypt();
});
ui.nip04Decrypt.addEventListener('click', () => {
  void runNip04Decrypt();
});
ui.nip04SendDm.addEventListener('click', () => {
  void runNip04SendDm();
});
ui.nip17UseSelf.addEventListener('click', () => {
  void fillSelfPubkey(ui.nip17Peer, 'NIP-17');
});
ui.nip17SendDm.addEventListener('click', () => {
  void runNip17SendDm();
});

log(
  'Ready. Open the host app (default http://localhost:5173/#/settings) to create a passkey first.'
);
