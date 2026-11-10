import type { NostrEvent } from './types.js';

/** 署名対象を決めるフィールドだけを持つイベント。 */
export type UnsignedEventTemplate = Pick<NostrEvent, 'kind' | 'content' | 'tags' | 'created_at'>;

const MAX_KIND = 65535;

/**
 * tags を写し取る。文字列配列の配列でなければ `null`。
 *
 * 添字で 1 回ずつ読み、読んだ値をそのまま写す。`every` は配列の穴を飛ばすので
 * 穴あき配列が検証を通ってしまい、検証と別に読み直すと値を差し替えられる。
 */
function copyTags(value: unknown): string[][] | null {
  if (!Array.isArray(value)) return null;
  const tags: string[][] = [];
  for (let i = 0; i < value.length; i++) {
    const tag: unknown = value[i];
    if (!Array.isArray(tag)) return null;
    const copy: string[] = [];
    for (let j = 0; j < tag.length; j++) {
      const item: unknown = tag[j];
      if (typeof item !== 'string') return null;
      copy.push(item);
    }
    tags.push(copy);
  }
  return tags;
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
  const copiedTags = tags === undefined ? undefined : copyTags(tags);
  if (copiedTags === null) {
    throw new Error('Invalid event: tags must be an array of string arrays');
  }
  if (
    created_at !== undefined &&
    (typeof created_at !== 'number' || !Number.isSafeInteger(created_at) || created_at < 0)
  ) {
    throw new Error('Invalid event: created_at must be a non-negative integer');
  }

  const template: UnsignedEventTemplate = { kind, content };
  if (copiedTags !== undefined) template.tags = copiedTags;
  if (created_at !== undefined) template.created_at = created_at;
  return template;
}
