/**
 * Nosskey iframe bridge — postMessage protocol + Host / Client helpers.
 * @packageDocumentation
 */

export { NosskeyIframeHost } from './host.js';
export type { ConsentRequest, NosskeyIframeHostOptions } from './host.js';
export {
  NOSSKEY_ERROR_CODES,
  isNosskeyReady,
  isNosskeyRequest,
  isNosskeyResponse,
} from './protocol.js';
export type {
  NosskeyErrorCode,
  NosskeyMessage,
  NosskeyMethod,
  NosskeyReady,
  NosskeyRequest,
  NosskeyRequestParams,
  NosskeyResponse,
} from './protocol.js';
