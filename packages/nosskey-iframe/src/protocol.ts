/**
 * Protocol definitions for the Nosskey iframe bridge.
 *
 * Messages exchanged between parent page (NosskeyIframeClient) and the
 * iframe signing provider (NosskeyIframeHost) over `window.postMessage`.
 *
 * @packageDocumentation
 */
import type { NostrEvent } from 'nosskey-sdk';

/** Supported NIP-07 methods the iframe provider can execute. */
export type NosskeyMethod = 'getPublicKey' | 'signEvent' | 'getRelays';

/**
 * NIP-07 `getRelays()` return shape: a map of relay URL to read/write flags.
 */
export type RelayMap = Record<string, { read: boolean; write: boolean }>;

/** Error codes returned in a {@link NosskeyResponse}. */
export type NosskeyErrorCode =
  | 'NOT_AUTHORIZED'
  | 'NO_KEY'
  | 'USER_REJECTED'
  | 'UNKNOWN_METHOD'
  | 'INVALID_REQUEST'
  | 'INTERNAL';

/** All error codes enumerated (used for exhaustiveness tests). */
export const NOSSKEY_ERROR_CODES: readonly NosskeyErrorCode[] = [
  'NOT_AUTHORIZED',
  'NO_KEY',
  'USER_REJECTED',
  'UNKNOWN_METHOD',
  'INVALID_REQUEST',
  'INTERNAL',
] as const;

/** Parameters for a {@link NosskeyRequest}. */
export interface NosskeyRequestParams {
  /** Event payload for `signEvent`. */
  event?: NostrEvent;
}

/** Request sent from parent → iframe. */
export interface NosskeyRequest {
  type: 'nosskey:request';
  /** Correlation id (expected to be a UUID). */
  id: string;
  method: NosskeyMethod;
  params?: NosskeyRequestParams;
}

/** Response sent from iframe → parent. */
export interface NosskeyResponse {
  type: 'nosskey:response';
  /** Correlates with the originating {@link NosskeyRequest.id}. */
  id: string;
  result?: unknown;
  error?: { code: NosskeyErrorCode; message: string };
}

/** Ready signal from iframe → parent, dispatched once the host starts listening. */
export interface NosskeyReady {
  type: 'nosskey:ready';
}

/**
 * Visibility request from iframe → parent, asking the parent to show or hide
 * the iframe element. Used when the iframe needs a user gesture (e.g. the
 * Storage Access API prompt for partitioned storage recovery).
 */
export interface NosskeyVisibility {
  type: 'nosskey:visibility';
  visible: boolean;
}

/** Any message defined by this protocol. */
export type NosskeyMessage = NosskeyRequest | NosskeyResponse | NosskeyReady | NosskeyVisibility;

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isSupportedMethod(x: unknown): x is NosskeyMethod {
  return x === 'getPublicKey' || x === 'signEvent' || x === 'getRelays';
}

function isErrorCode(x: unknown): x is NosskeyErrorCode {
  return typeof x === 'string' && (NOSSKEY_ERROR_CODES as readonly string[]).includes(x);
}

/** Type guard: does the value look like a {@link NosskeyRequest}? */
export function isNosskeyRequest(value: unknown): value is NosskeyRequest {
  if (!isPlainObject(value)) return false;
  if (value.type !== 'nosskey:request') return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (!isSupportedMethod(value.method)) return false;
  if (value.params !== undefined && !isPlainObject(value.params)) return false;
  return true;
}

/** Type guard: does the value look like a {@link NosskeyResponse}? */
export function isNosskeyResponse(value: unknown): value is NosskeyResponse {
  if (!isPlainObject(value)) return false;
  if (value.type !== 'nosskey:response') return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  const hasResult = 'result' in value;
  const hasError = 'error' in value && value.error !== undefined;
  if (hasError) {
    if (!isPlainObject(value.error)) return false;
    if (!isErrorCode((value.error as Record<string, unknown>).code)) return false;
    if (typeof (value.error as Record<string, unknown>).message !== 'string') return false;
  }
  // A response must carry either result or error.
  return hasResult || hasError;
}

/** Type guard: does the value look like a {@link NosskeyReady}? */
export function isNosskeyReady(value: unknown): value is NosskeyReady {
  return isPlainObject(value) && value.type === 'nosskey:ready';
}

/** Type guard: does the value look like a {@link NosskeyVisibility}? */
export function isNosskeyVisibility(value: unknown): value is NosskeyVisibility {
  if (!isPlainObject(value)) return false;
  if (value.type !== 'nosskey:visibility') return false;
  return typeof value.visible === 'boolean';
}
