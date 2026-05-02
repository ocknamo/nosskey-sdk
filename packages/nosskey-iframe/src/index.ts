/**
 * Nosskey iframe bridge — postMessage protocol + Host / Client helpers.
 * @packageDocumentation
 */

export { NosskeyIframeClient, NosskeyIframeError } from './client.js';
export type { NosskeyIframeClientOptions } from './client.js';
export { NosskeyIframeHost } from './host.js';
export type { ConsentRequest, NosskeyIframeHostOptions } from './host.js';
export {
  NOSSKEY_ERROR_CODES,
  isDecryptMethod,
  isEncryptMethod,
  isNosskeyReady,
  isNosskeyRequest,
  isNosskeyResponse,
  isNosskeyVisibility,
} from './protocol.js';
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
