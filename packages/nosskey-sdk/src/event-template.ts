import type { NostrEvent } from './types.js';

/** 署名対象を決めるフィールドだけを持つイベント。 */
export type UnsignedEventTemplate = Pick<NostrEvent, 'kind' | 'content' | 'tags' | 'created_at'>;

const MAX_KIND = 65535;

function isTags(value: unknown): value is string[][] {
  return (
    Array.isArray(value) &&
    value.every((tag) => Array.isArray(tag) && tag.every((item) => typeof item === 'string'))
  );
}

/**
 * 呼び出し元のイベントから、署名対象を決めるフィールドだけを写し取る。
 *
 * `@rx-nostr/crypto` の署名器は渡された `id` / `sig` / `pubkey` を計算値より優先する。
 * 残すと、内容と無関係な `id` に署名させたり、署名せずに素通しさせたりできる。
 *
 * エラーに入力値を載せない（イベント本文がログへ出るのを避ける）。
 */
export function toUnsignedEventTemplate(event: unknown): UnsignedEventTemplate {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) {
    throw new Error('Invalid event: expected an object');
  }
  const { kind, content, tags, created_at } = event as Record<string, unknown>;

  if (typeof kind !== 'number' || !Number.isInteger(kind) || kind < 0 || kind > MAX_KIND) {
    throw new Error('Invalid event: kind must be an integer between 0 and 65535');
  }
  if (typeof content !== 'string') {
    throw new Error('Invalid event: content must be a string');
  }
  if (tags !== undefined && !isTags(tags)) {
    throw new Error('Invalid event: tags must be an array of string arrays');
  }
  if (
    created_at !== undefined &&
    (typeof created_at !== 'number' || !Number.isSafeInteger(created_at) || created_at < 0)
  ) {
    throw new Error('Invalid event: created_at must be a non-negative integer');
  }

  const template: UnsignedEventTemplate = { kind, content };
  // 写しを渡す。署名までの await の間に呼び出し元が配列を書き換えても影響しない。
  if (tags !== undefined) template.tags = tags.map((tag) => [...tag]);
  if (created_at !== undefined) template.created_at = created_at;
  return template;
}
