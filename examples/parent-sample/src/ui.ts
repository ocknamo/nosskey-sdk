/**
 * DOM/UI helpers for the parent-sample app. Nothing in here knows about
 * nostr business logic — it queries elements declared in index.html, applies
 * theme classes, manages modal visibility, and renders log/status lines.
 */

export type ThemeChoice = 'auto' | 'light' | 'dark';
export type LangChoice = 'auto' | 'ja' | 'en';
export type Logger = (line: string) => void;

export interface UiElements {
  iframeUrl: HTMLInputElement;
  parentTheme: HTMLSelectElement;
  parentLang: HTMLSelectElement;
  relayUrl: HTMLInputElement;
  note: HTMLTextAreaElement;
  connect: HTMLButtonElement;
  disconnect: HTMLButtonElement;
  getPubkey: HTMLButtonElement;
  getRelays: HTMLButtonElement;
  relaysOutput: HTMLPreElement;
  signPublish: HTMLButtonElement;
  nip44Peer: HTMLInputElement;
  nip44UseSelf: HTMLButtonElement;
  nip44Plaintext: HTMLTextAreaElement;
  nip44Encrypt: HTMLButtonElement;
  nip44Decrypt: HTMLButtonElement;
  nip44Ciphertext: HTMLTextAreaElement;
  nip44Decrypted: HTMLPreElement;
  nip04Peer: HTMLInputElement;
  nip04UseSelf: HTMLButtonElement;
  nip04Plaintext: HTMLTextAreaElement;
  nip04Encrypt: HTMLButtonElement;
  nip04Decrypt: HTMLButtonElement;
  nip04Ciphertext: HTMLTextAreaElement;
  nip04Decrypted: HTMLPreElement;
  nip04SendDm: HTMLButtonElement;
  nip17Peer: HTMLInputElement;
  nip17UseSelf: HTMLButtonElement;
  nip17Plaintext: HTMLTextAreaElement;
  nip17SendDm: HTMLButtonElement;
  status: HTMLSpanElement;
  log: HTMLPreElement;
}

export function requireEl<T extends Element>(parent: ParentNode, selector: string): T {
  const el = parent.querySelector<T>(selector);
  if (!el) {
    throw new Error(`UI element missing: ${selector}`);
  }
  return el;
}

export function queryUiElements(app: ParentNode): UiElements {
  return {
    iframeUrl: requireEl<HTMLInputElement>(app, '#iframe-url'),
    parentTheme: requireEl<HTMLSelectElement>(app, '#parent-theme'),
    parentLang: requireEl<HTMLSelectElement>(app, '#parent-lang'),
    relayUrl: requireEl<HTMLInputElement>(app, '#relay-url'),
    note: requireEl<HTMLTextAreaElement>(app, '#note'),
    connect: requireEl<HTMLButtonElement>(app, '#connect'),
    disconnect: requireEl<HTMLButtonElement>(app, '#disconnect'),
    getPubkey: requireEl<HTMLButtonElement>(app, '#get-pubkey'),
    getRelays: requireEl<HTMLButtonElement>(app, '#get-relays'),
    relaysOutput: requireEl<HTMLPreElement>(app, '#relays-output'),
    signPublish: requireEl<HTMLButtonElement>(app, '#sign-publish'),
    nip44Peer: requireEl<HTMLInputElement>(app, '#nip44-peer'),
    nip44UseSelf: requireEl<HTMLButtonElement>(app, '#nip44-use-self'),
    nip44Plaintext: requireEl<HTMLTextAreaElement>(app, '#nip44-plaintext'),
    nip44Encrypt: requireEl<HTMLButtonElement>(app, '#nip44-encrypt'),
    nip44Decrypt: requireEl<HTMLButtonElement>(app, '#nip44-decrypt'),
    nip44Ciphertext: requireEl<HTMLTextAreaElement>(app, '#nip44-ciphertext'),
    nip44Decrypted: requireEl<HTMLPreElement>(app, '#nip44-decrypted'),
    nip04Peer: requireEl<HTMLInputElement>(app, '#nip04-peer'),
    nip04UseSelf: requireEl<HTMLButtonElement>(app, '#nip04-use-self'),
    nip04Plaintext: requireEl<HTMLTextAreaElement>(app, '#nip04-plaintext'),
    nip04Encrypt: requireEl<HTMLButtonElement>(app, '#nip04-encrypt'),
    nip04Decrypt: requireEl<HTMLButtonElement>(app, '#nip04-decrypt'),
    nip04Ciphertext: requireEl<HTMLTextAreaElement>(app, '#nip04-ciphertext'),
    nip04Decrypted: requireEl<HTMLPreElement>(app, '#nip04-decrypted'),
    nip04SendDm: requireEl<HTMLButtonElement>(app, '#nip04-send-dm'),
    nip17Peer: requireEl<HTMLInputElement>(app, '#nip17-peer'),
    nip17UseSelf: requireEl<HTMLButtonElement>(app, '#nip17-use-self'),
    nip17Plaintext: requireEl<HTMLTextAreaElement>(app, '#nip17-plaintext'),
    nip17SendDm: requireEl<HTMLButtonElement>(app, '#nip17-send-dm'),
    status: requireEl<HTMLSpanElement>(app, '#status'),
    log: requireEl<HTMLPreElement>(app, '#log'),
  };
}

function resolveParentTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// theme は親ページの body クラスに反映する必要があるため、`auto` を `light`/`dark`
// に解決する。一方 `lang` は親ページが直接使わないので解決不要 — iframe 側の
// i18n-store.ts が `auto` を navigator.language で解決する。
export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  return choice === 'auto' ? resolveParentTheme() : choice;
}

export function applyParentTheme(theme: 'light' | 'dark'): void {
  document.body.classList.remove('parent-theme-light', 'parent-theme-dark');
  document.body.classList.add(`parent-theme-${theme}`);
}

export function clearParentTheme(): void {
  document.body.classList.remove('parent-theme-light', 'parent-theme-dark');
}

export function setModalVisible(modal: HTMLElement, visible: boolean): void {
  modal.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

export function installModalVisibilityListener(modal: HTMLElement): void {
  window.addEventListener('message', (event) => {
    const data = event.data as unknown;
    if (
      data &&
      typeof data === 'object' &&
      (data as { type?: unknown }).type === 'nosskey:visibility'
    ) {
      setModalVisible(modal, Boolean((data as { visible?: unknown }).visible));
    }
  });
}

export function createLogger(logEl: HTMLPreElement): Logger {
  return (line: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  };
}

export function setStatus(
  statusEl: HTMLSpanElement,
  text: string,
  variant: '' | 'ok' | 'err' = ''
): void {
  statusEl.textContent = text;
  statusEl.className = variant ? `status ${variant}` : 'status';
}

export function setConnectedUI(ui: UiElements, connected: boolean): void {
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
