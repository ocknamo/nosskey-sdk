import { NosskeyIframeClient, NosskeyIframeError } from 'nosskey-iframe';
import type { NostrEvent } from 'nosskey-sdk';

interface NostrProvider {
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<NostrEvent>;
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
    <h2>3. Sign &amp; publish kind:1 note</h2>
    <label for="note">Note content</label>
    <textarea id="note">${DEFAULT_NOTE}</textarea>
    <label for="relay-url" style="margin-top:12px;">Relay URL</label>
    <input id="relay-url" type="url" value="${DEFAULT_RELAY_URL}" />
    <div class="row">
      <button id="sign-publish" disabled>Sign &amp; publish</button>
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
  relayUrl: requireEl<HTMLInputElement>('#relay-url'),
  note: requireEl<HTMLTextAreaElement>('#note'),
  connect: requireEl<HTMLButtonElement>('#connect'),
  disconnect: requireEl<HTMLButtonElement>('#disconnect'),
  getPubkey: requireEl<HTMLButtonElement>('#get-pubkey'),
  signPublish: requireEl<HTMLButtonElement>('#sign-publish'),
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
  ui.disconnect.disabled = !connected;
  ui.getPubkey.disabled = !connected;
  ui.signPublish.disabled = !connected;
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
  log(`Mounting iframe: ${iframeUrl}`);
  try {
    const next = new NosskeyIframeClient({ iframeUrl });
    client = next;
    await next.ready();
    window.nostr = {
      getPublicKey: () => next.getPublicKey(),
      signEvent: (event) => next.signEvent(event),
    };
    setConnectedUI(true);
    setStatus('connected', 'ok');
    log('Received nosskey:ready. window.nostr is now available.');
  } catch (err) {
    log(`Connect failed: ${formatError(err)}`);
    setStatus('connect failed', 'err');
    client?.destroy();
    client = null;
    window.nostr = undefined;
    setConnectedUI(false);
  }
}

function disconnect(): void {
  if (!client) return;
  client.destroy();
  client = null;
  window.nostr = undefined;
  setConnectedUI(false);
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

ui.connect.addEventListener('click', () => {
  void connect();
});
ui.disconnect.addEventListener('click', disconnect);
ui.getPubkey.addEventListener('click', () => {
  void getPubkey();
});
ui.signPublish.addEventListener('click', () => {
  void signAndPublish();
});

log(
  'Ready. Open the host app (default http://localhost:5173/#/settings) to create a passkey first.'
);
