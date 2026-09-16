/**
 * Nosskey iframe bridge — postMessage protocol + Host / Client helpers.
 * @packageDocumentation
 */

export type { NosskeyIframeClientOptions } from './client.js';
export { NosskeyIframeClient, NosskeyIframeError } from './client.js';
export type { ConsentRequest, NosskeyIframeHostOptions, RateLimitOptions } from './host.js';
export { KEY_RECOVERY_TIMEOUT_MS, NosskeyIframeHost, STORAGE_READY_TIMEOUT_MS } from './host.js';
export type {
  NosskeyErrorCode,
  NosskeyMessage,
  NosskeyMethod,
  NosskeyReady,
  NosskeyRequest,
  NosskeyRequestParams,
  NosskeyResponse,
  NosskeyVisibility,
  RelayMap,
} from './protocol.js';
export {
  CONSENT_REQUIRED_METHODS,
  isConnectMethod,
  isDecryptMethod,
  isEncryptMethod,
  isNosskeyReady,
  isNosskeyRequest,
  isNosskeyResponse,
  isNosskeyVisibility,
  NOSSKEY_ERROR_CODES,
} from './protocol.js';
export type { NosskeyManagerLike, NostrEvent } from './types.js';
