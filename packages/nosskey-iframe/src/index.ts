/**
 * Nosskey iframe bridge — postMessage protocol + Host / Client helpers.
 * @packageDocumentation
 */

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
