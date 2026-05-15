import { NosskeyIframeClient, NosskeyIframeError } from 'nosskey-iframe';
import type { NostrEvent } from 'nosskey-sdk';
import { sendNip17Dm } from './nip17.js';

interface NostrProvider {
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

declare global {
  interface Window {
    nostr?: NostrProvider;
  }
}

const DEFAULT_IFRAME_URL = 'https://nosskey.app/#/iframe';
const DEFAULT_RELAY_URL = 'wss://relay.damus.io';
const DEFAULT_NOTE = 'Hello from Nosskey iframe parent sample!';
const PUBLISH_ACK_TIMEOUT_MS = 8000;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app element missing from index.html');
}

const modal = document.querySelector<HTMLDivElement>('#iframe-modal');
const modalCard = modal?.querySelector<HTMLDivElement>('.iframe-modal__card') ?? null;
if (!modal || !modalCard) {
  throw new Error('#iframe-modal markup missing from index.html');
}

function setModalVisible(visible: boolean): void {
  modal?.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

type ThemeChoice = 'auto' | 'light' | 'dark';
type LangChoice = 'auto' | 'ja' | 'en';

function resolveParentTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// theme は親ページの body クラスに反映する必要があるため、`auto` を `light`/`dark`
// に解決する。一方 `lang` は親ページが直接使わないので解決不要 — iframe 側の
// i18n-store.ts が `auto` を navigator.language で解決する。
function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  return choice === 'auto' ? resolveParentTheme() : choice;
}

function applyParentTheme(theme: 'light' | 'dark'): void {
  document.body.classList.remove('parent-theme-light', 'parent-theme-dark');
  document.body.classList.add(`parent-theme-${theme}`);
}

function clearParentTheme(): void {
  document.body.classList.remove('parent-theme-light', 'parent-theme-dark');
}

window.addEventListener('message', (event) => {
  const data = event.data as unknown;
  if (
    data &&
    typeof data === 'object' &&
    (data as { type?: unknown }).type === 'nosskey:visibility'
  ) {
    setModalVisible(Boolean((data as { visible?: unknown }).visible));
  }
});

app.innerHTML = `
  <h1>Nosskey iframe parent sample</h1>
  <p class="subtitle">
    Mounts the Nosskey signing iframe, exposes a NIP-07 compatible
    <code>window.nostr</code>, and publishes a signed kind:1 note to a relay.
  </p>

  <section>
    <h2>1. Connect to iframe</h2>
    <label for="iframe-url">Iframe URL</label>
    <input id="iframe-url" type="url" value="${DEFAULT_IFRAME_URL}" />
    <div class="row">
      <label for="parent-theme">Theme</label>
      <select id="parent-theme">
        <option value="auto" selected>auto</option>
        <option value="light">light</option>
        <option value="dark">dark</option>
      </select>
      <label for="parent-lang">Lang</label>
      <select id="parent-lang">
        <option value="auto" selected>auto</option>
        <option value="ja">ja</option>
        <option value="en">en</option>
      </select>
    </div>
    <p class="hint">
      Changing theme or lang while connected re-mounts the iframe with new
      query parameters (<code>?embedded=1&amp;theme=...&amp;lang=...</code>).
      The current session state inside the iframe is reset.
    </p>
    <div class="row">
      <button id="connect">Connect</button>
      <button id="disconnect" class="secondary" disabled>Disconnect</button>
      <span id="status" class="status">disconnected</span>
    </div>
  </section>

  <section>
    <h2>2. Get public key</h2>
    <div class="row">
      <button id="get-pubkey" disabled>Call window.nostr.getPublicKey()</button>
    </div>
  </section>

  <section>
    <h2>3. Get relays</h2>
    <div class="row">
      <button id="get-relays" disabled>Call window.nostr.getRelays()</button>
    </div>
    <pre id="relays-output">No relays fetched yet.</pre>
  </section>

  <section>
    <h2>4. Sign &amp; publish kind:1 note</h2>
    <label for="note">Note content</label>
    <textarea id="note">${DEFAULT_NOTE}</textarea>
    <label for="relay-url" style="margin-top:12px;">Relay URL</label>
    <input id="relay-url" type="url" value="${DEFAULT_RELAY_URL}" />
    <div class="row">
      <button id="sign-publish" disabled>Sign &amp; publish</button>
    </div>
  </section>

  <section>
    <h2>5. NIP-44 encrypt / decrypt</h2>
    <p class="hint">
      Modern (recommended) DM encryption. Self-encrypt by clicking
      <em>Use my pubkey</em> to populate the peer field with the public key
      from this iframe — both encrypt and decrypt will use the same key,
      so you can verify the round trip without a second account.
    </p>
    <label for="nip44-peer">Peer public key (hex, 64 chars)</label>
    <div class="row">
      <input id="nip44-peer" type="text" placeholder="64 hex characters" />
      <button id="nip44-use-self" class="secondary" disabled>Use my pubkey</button>
    </div>
    <label for="nip44-plaintext" style="margin-top:12px;">Plaintext</label>
    <textarea id="nip44-plaintext">hello, NIP-44 🌸</textarea>
    <div class="row">
      <button id="nip44-encrypt" disabled>Encrypt → ciphertext</button>
      <button id="nip44-decrypt" disabled>Decrypt → plaintext</button>
    </div>
    <label for="nip44-ciphertext" style="margin-top:12px;">Ciphertext (base64)</label>
    <textarea id="nip44-ciphertext" placeholder="paste a NIP-44 v2 payload here, or click Encrypt above"></textarea>
    <label for="nip44-decrypted" style="margin-top:12px;">Decrypted output</label>
    <pre id="nip44-decrypted">No decryption attempted yet.</pre>
  </section>

  <section>
    <h2>6. NIP-04 encrypt / decrypt (legacy)</h2>
    <p class="hint warn">
      ⚠️ NIP-04 is AES-CBC without authentication and is deprecated by the
      spec itself. Use NIP-44 for new messages. This section is provided
      only to verify interop with older clients.
    </p>
    <label for="nip04-peer">Peer public key (hex, 64 chars)</label>
    <div class="row">
      <input id="nip04-peer" type="text" placeholder="64 hex characters" />
      <button id="nip04-use-self" class="secondary" disabled>Use my pubkey</button>
    </div>
    <label for="nip04-plaintext" style="margin-top:12px;">Plaintext</label>
    <textarea id="nip04-plaintext">hello, NIP-04 (legacy)</textarea>
    <div class="row">
      <button id="nip04-encrypt" disabled>Encrypt → ciphertext</button>
      <button id="nip04-decrypt" disabled>Decrypt → plaintext</button>
    </div>
    <label for="nip04-ciphertext" style="margin-top:12px;">Ciphertext (base64?iv=base64)</label>
    <textarea id="nip04-ciphertext" placeholder="paste a NIP-04 payload here, or click Encrypt above"></textarea>
    <label for="nip04-decrypted" style="margin-top:12px;">Decrypted output</label>
    <pre id="nip04-decrypted">No decryption attempted yet.</pre>
    <p class="hint">
      <strong>Send DM</strong> below encrypts the plaintext to the peer
      pubkey, builds a kind:4 event with a <code>p</code> tag, signs it
      through the iframe (consent dialog appears twice — once for encrypt,
      once for sign), and publishes to the Relay URL from section 4.
    </p>
    <div class="row">
      <button id="nip04-send-dm" disabled>Send DM (kind:4 → relay)</button>
    </div>
  </section>

  <section>
    <h2>7. NIP-17 sealed DM (gift-wrapped kind:1059)</h2>
    <p class="hint">
      Standards-compliant DM path: builds a kind:14 rumor, NIP-44 seals it
      into a kind:13, then NIP-44 wraps that into a kind:1059 signed by a
      throwaway ephemeral key. Compatible clients (Amethyst, 0xchat,
      Coracle, Damus chat) listen for kind:1059 and decrypt automatically.
      Two consent dialogs appear (NIP-44 encrypt for the seal, then sign
      kind:13). The Relay URL is shared with section 4.
    </p>
    <label for="nip17-peer">Peer public key (hex, 64 chars)</label>
    <div class="row">
      <input id="nip17-peer" type="text" placeholder="64 hex characters" />
      <button id="nip17-use-self" class="secondary" disabled>Use my pubkey</button>
    </div>
    <label for="nip17-plaintext" style="margin-top:12px;">Message</label>
    <textarea id="nip17-plaintext">hello, NIP-17 🎁</textarea>
    <div class="row">
      <button id="nip17-send-dm" disabled>Send NIP-17 DM (kind:1059 → relay)</button>
    </div>
  </section>

  <section>
    <h2>Log</h2>
    <pre id="log"></pre>
  </section>
`;

function requireEl<T extends Element>(selector: string): T {
  const el = app.querySelector<T>(selector);
  if (!el) {
    throw new Error(`UI element missing: ${selector}`);
  }
  return el;
}

const ui = {
  iframeUrl: requireEl<HTMLInputElement>('#iframe-url'),
  parentTheme: requireEl<HTMLSelectElement>('#parent-theme'),
  parentLang: requireEl<HTMLSelectElement>('#parent-lang'),
  relayUrl: requireEl<HTMLInputElement>('#relay-url'),
  note: requireEl<HTMLTextAreaElement>('#note'),
  connect: requireEl<HTMLButtonElement>('#connect'),
  disconnect: requireEl<HTMLButtonElement>('#disconnect'),
  getPubkey: requireEl<HTMLButtonElement>('#get-pubkey'),
  getRelays: requireEl<HTMLButtonElement>('#get-relays'),
  relaysOutput: requireEl<HTMLPreElement>('#relays-output'),
  signPublish: requireEl<HTMLButtonElement>('#sign-publish'),
  nip44Peer: requireEl<HTMLInputElement>('#nip44-peer'),
  nip44UseSelf: requireEl<HTMLButtonElement>('#nip44-use-self'),
  nip44Plaintext: requireEl<HTMLTextAreaElement>('#nip44-plaintext'),
  nip44Encrypt: requireEl<HTMLButtonElement>('#nip44-encrypt'),
  nip44Decrypt: requireEl<HTMLButtonElement>('#nip44-decrypt'),
  nip44Ciphertext: requireEl<HTMLTextAreaElement>('#nip44-ciphertext'),
  nip44Decrypted: requireEl<HTMLPreElement>('#nip44-decrypted'),
  nip04Peer: requireEl<HTMLInputElement>('#nip04-peer'),
  nip04UseSelf: requireEl<HTMLButtonElement>('#nip04-use-self'),
  nip04Plaintext: requireEl<HTMLTextAreaElement>('#nip04-plaintext'),
  nip04Encrypt: requireEl<HTMLButtonElement>('#nip04-encrypt'),
  nip04Decrypt: requireEl<HTMLButtonElement>('#nip04-decrypt'),
  nip04Ciphertext: requireEl<HTMLTextAreaElement>('#nip04-ciphertext'),
  nip04Decrypted: requireEl<HTMLPreElement>('#nip04-decrypted'),
  nip04SendDm: requireEl<HTMLButtonElement>('#nip04-send-dm'),
  nip17Peer: requireEl<HTMLInputElement>('#nip17-peer'),
  nip17UseSelf: requireEl<HTMLButtonElement>('#nip17-use-self'),
  nip17Plaintext: requireEl<HTMLTextAreaElement>('#nip17-plaintext'),
  nip17SendDm: requireEl<HTMLButtonElement>('#nip17-send-dm'),
  status: requireEl<HTMLSpanElement>('#status'),
  log: requireEl<HTMLPreElement>('#log'),
};

let client: NosskeyIframeClient | null = null;

function log(line: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  ui.log.textContent += `[${ts}] ${line}\n`;
  ui.log.scrollTop = ui.log.scrollHeight;
}

function setStatus(text: string, variant: '' | 'ok' | 'err' = ''): void {
  ui.status.textContent = text;
  ui.status.className = variant ? `status ${variant}` : 'status';
}

function setConnectedUI(connected: boolean): void {
  ui.connect.disabled = connected;
  ui.iframeUrl.disabled = connected;
  // Theme/lang selects remain enabled while connected so the user can switch
  // and trigger a re-mount; the change handler does the disconnect+reconnect.
  ui.disconnect.disabled = !connected;
  ui.getPubkey.disabled = !connected;
  ui.getRelays.disabled = !connected;
  ui.signPublish.disabled = !connected;
  ui.nip44UseSelf.disabled = !connected;
  ui.nip44Encrypt.disabled = !connected;
  ui.nip44Decrypt.disabled = !connected;
  ui.nip04UseSelf.disabled = !connected;
  ui.nip04Encrypt.disabled = !connected;
  ui.nip04Decrypt.disabled = !connected;
  ui.nip04SendDm.disabled = !connected;
  ui.nip17UseSelf.disabled = !connected;
  ui.nip17SendDm.disabled = !connected;
}

function formatError(err: unknown): string {
  if (err instanceof NosskeyIframeError) {
    return `NosskeyIframeError[${err.code}]: ${err.message}`;
  }
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

async function connect(): Promise<void> {
  const iframeUrl = ui.iframeUrl.value.trim();
  if (!iframeUrl) {
    log('Connect aborted: iframe URL is empty.');
    return;
  }
  setStatus('connecting…');
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
    setConnectedUI(true);
    setStatus('connected', 'ok');
    log('Received nosskey:ready. window.nostr is now available.');
  } catch (err) {
    log(`Connect failed: ${formatError(err)}`);
    next?.destroy();
    // Only reset shared UI state if this connect() still owns the client slot.
    if (next === null || client === next) {
      client = null;
      window.nostr = undefined;
      setConnectedUI(false);
      setModalVisible(false);
      clearParentTheme();
      setStatus('connect failed', 'err');
    }
  }
}

function disconnect(): void {
  if (!client) return;
  client.destroy();
  client = null;
  window.nostr = undefined;
  setConnectedUI(false);
  setModalVisible(false);
  clearParentTheme();
  setStatus('disconnected');
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

function publishEvent(relayUrl: string, event: NostrEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl);
    } catch (err) {
      reject(err);
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      log(`Relay ${relayUrl}: no OK/NOTICE within ${PUBLISH_ACK_TIMEOUT_MS}ms, closing.`);
      ws.close();
      resolve();
    }, PUBLISH_ACK_TIMEOUT_MS);

    ws.addEventListener('open', () => {
      log(`Relay ${relayUrl}: connection open, sending EVENT.`);
      ws.send(JSON.stringify(['EVENT', event]));
    });

    ws.addEventListener('message', (msg) => {
      const data = typeof msg.data === 'string' ? msg.data : '<binary>';
      log(`Relay ${relayUrl}: ${data}`);
      if (data === '<binary>') return;
      try {
        const parsed: unknown = JSON.parse(data);
        if (Array.isArray(parsed) && (parsed[0] === 'OK' || parsed[0] === 'NOTICE') && !settled) {
          settled = true;
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      } catch {
        // Non-JSON payload — ignore and wait for timer.
      }
    });

    ws.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`WebSocket error for ${relayUrl}`));
    });

    ws.addEventListener('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });
  });
}

async function signAndPublish(): Promise<void> {
  if (!window.nostr) return;
  const content = ui.note.value;
  const relayUrl = ui.relayUrl.value.trim();
  if (!relayUrl) {
    log('Sign aborted: relay URL is empty.');
    return;
  }

  const draft: NostrEvent = {
    kind: 1,
    content,
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
  };

  log('Requesting window.nostr.signEvent() for kind:1 note…');
  let signed: NostrEvent;
  try {
    signed = await window.nostr.signEvent(draft);
  } catch (err) {
    log(`signEvent failed: ${formatError(err)}`);
    return;
  }
  log(`Signed event: ${JSON.stringify(signed, null, 2)}`);

  try {
    await publishEvent(relayUrl, signed);
  } catch (err) {
    log(`Publish failed: ${formatError(err)}`);
  }
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

async function nip44Encrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = ui.nip44Peer.value.trim();
  const plain = ui.nip44Plaintext.value;
  if (!peer) {
    log('NIP-44 encrypt aborted: peer pubkey is empty.');
    return;
  }
  log(`Requesting window.nostr.nip44.encrypt() for ${plain.length} chars…`);
  try {
    const ciphertext = await window.nostr.nip44.encrypt(peer, plain);
    ui.nip44Ciphertext.value = ciphertext;
    log(`NIP-44 encrypt OK (${ciphertext.length} chars of base64).`);
  } catch (err) {
    log(`NIP-44 encrypt failed: ${formatError(err)}`);
  }
}

async function nip44Decrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = ui.nip44Peer.value.trim();
  const ciphertext = ui.nip44Ciphertext.value.trim();
  if (!peer || !ciphertext) {
    log('NIP-44 decrypt aborted: peer pubkey or ciphertext is empty.');
    return;
  }
  log('Requesting window.nostr.nip44.decrypt()…');
  try {
    const plaintext = await window.nostr.nip44.decrypt(peer, ciphertext);
    ui.nip44Decrypted.textContent = plaintext;
    log(`NIP-44 decrypt OK (${plaintext.length} chars).`);
  } catch (err) {
    const msg = formatError(err);
    log(`NIP-44 decrypt failed: ${msg}`);
    ui.nip44Decrypted.textContent = `Error: ${msg}`;
  }
}

/**
 * Run NIP-04 encryption and report length on success. Returns null on failure
 * (already logged). Shared by the encrypt button and the DM-send flow so the
 * two paths can't drift apart.
 */
async function performNip04Encrypt(peer: string, plain: string): Promise<string | null> {
  if (!window.nostr) return null;
  log(`Requesting window.nostr.nip04.encrypt() for ${plain.length} chars…`);
  try {
    const ciphertext = await window.nostr.nip04.encrypt(peer, plain);
    log(`NIP-04 encrypt OK (${ciphertext.length} chars).`);
    return ciphertext;
  } catch (err) {
    log(`NIP-04 encrypt failed: ${formatError(err)}`);
    return null;
  }
}

async function nip04Encrypt(): Promise<void> {
  const peer = ui.nip04Peer.value.trim();
  if (!peer) {
    log('NIP-04 encrypt aborted: peer pubkey is empty.');
    return;
  }
  const ciphertext = await performNip04Encrypt(peer, ui.nip04Plaintext.value);
  if (ciphertext !== null) {
    ui.nip04Ciphertext.value = ciphertext;
  }
}

async function nip04Decrypt(): Promise<void> {
  if (!window.nostr) return;
  const peer = ui.nip04Peer.value.trim();
  const ciphertext = ui.nip04Ciphertext.value.trim();
  if (!peer || !ciphertext) {
    log('NIP-04 decrypt aborted: peer pubkey or ciphertext is empty.');
    return;
  }
  log('Requesting window.nostr.nip04.decrypt()…');
  try {
    const plaintext = await window.nostr.nip04.decrypt(peer, ciphertext);
    ui.nip04Decrypted.textContent = plaintext;
    log(`NIP-04 decrypt OK (${plaintext.length} chars).`);
  } catch (err) {
    const msg = formatError(err);
    log(`NIP-04 decrypt failed: ${msg}`);
    ui.nip04Decrypted.textContent = `Error: ${msg}`;
  }
}

async function nip04SendDm(): Promise<void> {
  if (!window.nostr) return;
  const peer = ui.nip04Peer.value.trim();
  const relayUrl = ui.relayUrl.value.trim();
  if (!peer) {
    log('NIP-04 DM aborted: peer pubkey is empty.');
    return;
  }
  if (!relayUrl) {
    log('NIP-04 DM aborted: relay URL (section 4) is empty.');
    return;
  }

  // 1) encrypt — prompts encrypt consent
  log(`NIP-04 DM: encrypting to ${peer.slice(0, 8)}…`);
  const ciphertext = await performNip04Encrypt(peer, ui.nip04Plaintext.value);
  if (ciphertext === null) return;
  ui.nip04Ciphertext.value = ciphertext;

  // 2) build kind:4 + p-tag, sign — prompts sign consent
  const draft: NostrEvent = {
    kind: 4,
    content: ciphertext,
    tags: [['p', peer]],
    created_at: Math.floor(Date.now() / 1000),
  };
  log('NIP-04 DM: signing kind:4 event…');
  let signed: NostrEvent;
  try {
    signed = await window.nostr.signEvent(draft);
  } catch (err) {
    log(`NIP-04 DM signEvent failed: ${formatError(err)}`);
    return;
  }
  log(`NIP-04 DM: signed event id ${signed.id ?? '(missing id)'}.`);

  // 3) publish via the existing WebSocket helper
  try {
    await publishEvent(relayUrl, signed);
  } catch (err) {
    log(`NIP-04 DM publish failed: ${formatError(err)}`);
  }
}

async function nip17SendDm(): Promise<void> {
  if (!window.nostr) return;
  const nostr = window.nostr;
  const peer = ui.nip17Peer.value.trim();
  const relayUrl = ui.relayUrl.value.trim();
  const plaintext = ui.nip17Plaintext.value;
  if (!peer) {
    log('NIP-17 DM aborted: peer pubkey is empty.');
    return;
  }
  if (!relayUrl) {
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

  log(`NIP-17 DM: sealing rumor for ${peer.slice(0, 8)}… (consent dialog x2)`);
  try {
    const result = await sendNip17Dm({
      senderPubkey,
      peerPubkey: peer,
      plaintext,
      sealEncrypt: (p, plain) => nostr.nip44.encrypt(p, plain),
      signSeal: (draft) => nostr.signEvent(draft),
      publish: (event) => publishEvent(relayUrl, event),
    });
    log(`NIP-17 DM: gift wrap id ${result.giftWrap.id ?? '(missing id)'}`);
    log(`NIP-17 DM: ephemeral pubkey ${result.ephemeralPubkey}`);
  } catch (err) {
    log(`NIP-17 DM failed: ${formatError(err)}`);
  }
}

ui.connect.addEventListener('click', () => {
  void connect();
});
ui.disconnect.addEventListener('click', disconnect);

function remountIfConnected(reason: string): void {
  if (!client) return;
  log(`${reason}: re-mounting iframe…`);
  disconnect();
  void connect();
}
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
  void nip44Encrypt();
});
ui.nip44Decrypt.addEventListener('click', () => {
  void nip44Decrypt();
});
ui.nip04UseSelf.addEventListener('click', () => {
  void fillSelfPubkey(ui.nip04Peer, 'NIP-04');
});
ui.nip04Encrypt.addEventListener('click', () => {
  void nip04Encrypt();
});
ui.nip04Decrypt.addEventListener('click', () => {
  void nip04Decrypt();
});
ui.nip04SendDm.addEventListener('click', () => {
  void nip04SendDm();
});
ui.nip17UseSelf.addEventListener('click', () => {
  void fillSelfPubkey(ui.nip17Peer, 'NIP-17');
});
ui.nip17SendDm.addEventListener('click', () => {
  void nip17SendDm();
});

log(
  'Ready. Open the host app (default http://localhost:5173/#/settings) to create a passkey first.'
);
