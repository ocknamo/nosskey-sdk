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
import { publishEvent } from './relay.js';
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

const ui = queryUiElements(app);
const log = createLogger(ui.log);

installModalVisibilityListener(modal);

let client: NosskeyIframeClient | null = null;

function publish(relayUrl: string, event: NostrEvent): Promise<void> {
  return publishEvent(relayUrl, event, { log });
}

async function connect(): Promise<void> {
  const iframeUrl = ui.iframeUrl.value.trim();
  if (!iframeUrl) {
    log('Connect aborted: iframe URL is empty.');
    return;
  }
  setStatus(ui.status, 'connecting…');
  const themeChoice = ui.parentTheme.value as ThemeChoice;
  const langChoice = ui.parentLang.value as LangChoice;
  log(`Mounting iframe ${iframeUrl} with theme=${themeChoice}, lang=${langChoice}`);
  applyParentTheme(resolveTheme(themeChoice));
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
  } catch (err) {
    log(`Connect failed: ${formatError(err)}`);
    next?.destroy();
    // Only reset shared UI state if this connect() still owns the client slot.
    if (next === null || client === next) {
      client = null;
      window.nostr = undefined;
      setConnectedUI(ui, false);
      setModalVisible(modal, false);
      clearParentTheme();
      setStatus(ui.status, 'connect failed', 'err');
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
}

async function getPubkey(): Promise<void> {
  if (!window.nostr) return;
  log('Requesting window.nostr.getPublicKey()…');
  try {
    const pubkey = await window.nostr.getPublicKey();
    log(`pubkey: ${pubkey}`);
  } catch (err) {
    log(`getPublicKey failed: ${formatError(err)}`);
    if (err instanceof NosskeyIframeError && err.code === 'NO_KEY') {
      log(
        'Hint: browser storage may be partitioned for this cross-origin iframe. ' +
          'If the iframe became visible above, click "Grant storage access" in it, ' +
          'then retry Get public key. Otherwise, open the host URL directly in a ' +
          'tab, create a passkey, and try again.'
      );
    }
  }
}

async function getRelays(): Promise<void> {
  if (!window.nostr) return;
  log('Requesting window.nostr.getRelays()…');
  try {
    const relays = await window.nostr.getRelays();
    const count = Object.keys(relays).length;
    const formatted = count === 0 ? '{}' : JSON.stringify(relays, null, 2);
    ui.relaysOutput.textContent = formatted;
    log(`getRelays: ${count} relay(s) returned`);
  } catch (err) {
    const message = formatError(err);
    log(`getRelays failed: ${message}`);
    ui.relaysOutput.textContent = `Error: ${message}`;
  }
}

async function signAndPublish(): Promise<void> {
  if (!window.nostr) return;
  const relay = parseRelayUrl(ui.relayUrl.value);
  if (!relay.ok) {
    log(`Sign aborted: ${relay.reason}.`);
    return;
  }
  await signAndPublishNote({
    nostr: window.nostr,
    content: ui.note.value,
    relayUrl: relay.value,
    log,
    publish: (event) => publish(relay.value, event),
  });
}

async function fillSelfPubkey(target: HTMLInputElement, label: string): Promise<void> {
  if (!window.nostr) return;
  log(`${label}: requesting window.nostr.getPublicKey() to self-fill peer pubkey…`);
  try {
    target.value = await window.nostr.getPublicKey();
    log(`${label}: peer pubkey set to own pubkey.`);
  } catch (err) {
    log(`${label}: getPublicKey failed: ${formatError(err)}`);
  }
}

async function runNip44Encrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip44Peer.value);
  if (!peer.ok) {
    log(`NIP-44 encrypt aborted: ${peer.reason}.`);
    return;
  }
  const ciphertext = await nip44Encrypt({
    nostr: window.nostr,
    peer: peer.value,
    plaintext: ui.nip44Plaintext.value,
    log,
  });
  if (ciphertext !== null) {
    ui.nip44Ciphertext.value = ciphertext;
  }
}

async function runNip44Decrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip44Peer.value);
  const ciphertext = ui.nip44Ciphertext.value.trim();
  if (!peer.ok || !ciphertext) {
    log('NIP-44 decrypt aborted: peer pubkey or ciphertext is empty.');
    return;
  }
  const result = await nip44Decrypt({
    nostr: window.nostr,
    peer: peer.value,
    ciphertext,
    log,
  });
  ui.nip44Decrypted.textContent = result.ok ? result.plaintext : `Error: ${result.message}`;
}

async function runNip04Encrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip04Peer.value);
  if (!peer.ok) {
    log(`NIP-04 encrypt aborted: ${peer.reason}.`);
    return;
  }
  const ciphertext = await nip04Encrypt({
    nostr: window.nostr,
    peer: peer.value,
    plaintext: ui.nip04Plaintext.value,
    log,
  });
  if (ciphertext !== null) {
    ui.nip04Ciphertext.value = ciphertext;
  }
}

async function runNip04Decrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip04Peer.value);
  const ciphertext = ui.nip04Ciphertext.value.trim();
  if (!peer.ok || !ciphertext) {
    log('NIP-04 decrypt aborted: peer pubkey or ciphertext is empty.');
    return;
  }
  const result = await nip04Decrypt({
    nostr: window.nostr,
    peer: peer.value,
    ciphertext,
    log,
  });
  ui.nip04Decrypted.textContent = result.ok ? result.plaintext : `Error: ${result.message}`;
}

async function runNip04SendDm(): Promise<void> {
  if (!window.nostr) return;
  const peer = parsePeerPubkey(ui.nip04Peer.value);
  if (!peer.ok) {
    log(`NIP-04 DM aborted: ${peer.reason}.`);
    return;
  }
  const relay = parseRelayUrl(ui.relayUrl.value);
  if (!relay.ok) {
    log('NIP-04 DM aborted: relay URL (section 4) is empty.');
    return;
  }
  await nip04SendDm({
    nostr: window.nostr,
    peer: peer.value,
    plaintext: ui.nip04Plaintext.value,
    log,
    publish: (event) => publish(relay.value, event),
    onCiphertext: (ciphertext) => {
      ui.nip04Ciphertext.value = ciphertext;
    },
  });
}

async function runNip17SendDm(): Promise<void> {
  if (!window.nostr) return;
  const nostr = window.nostr;
  const peer = parsePeerPubkey(ui.nip17Peer.value);
  if (!peer.ok) {
    log(`NIP-17 DM aborted: ${peer.reason}.`);
    return;
  }
  const relay = parseRelayUrl(ui.relayUrl.value);
  if (!relay.ok) {
    log('NIP-17 DM aborted: relay URL (section 4) is empty.');
    return;
  }

  log('NIP-17 DM: resolving sender pubkey…');
  let senderPubkey: string;
  try {
    senderPubkey = await nostr.getPublicKey();
  } catch (err) {
    log(`NIP-17 DM getPublicKey failed: ${formatError(err)}`);
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
      publish: (event) => publish(relay.value, event),
    });
    log(`NIP-17 DM: gift wrap id ${result.giftWrap.id ?? '(missing id)'}`);
    log(`NIP-17 DM: ephemeral pubkey ${result.ephemeralPubkey}`);
  } catch (err) {
    log(`NIP-17 DM failed: ${formatError(err)}`);
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
