/**
 * NIP イベント kind 番号 → ユーザー可読ラベルへのマッピング。
 * よく使われる kind のみを翻訳対象とし、未知の kind は数値そのまま返す。
 * 翻訳は呼び出し元から `t` を受け取って解決する。
 */

export interface KindLabelMap {
  textNote: string; // kind 1
  follows: string; // kind 3
  legacyDm: string; // kind 4 (NIP-04)
  repost: string; // kind 6
  reaction: string; // kind 7
  channelMessage: string; // kind 42
  giftWrap: string; // kind 1059
  longForm: string; // kind 30023
  unknown: string; // フォールバック (引数に kind 番号を埋め込まない)
}

/**
 * kind 番号から人間可読ラベルを返す。`labels.unknown` 自体に番号は含まないため、
 * 呼び出し元は通常 "<label> (kind:N)" のように整形する。
 */
export function kindLabel(kind: number, labels: KindLabelMap): string {
  switch (kind) {
    case 1:
      return labels.textNote;
    case 3:
      return labels.follows;
    case 4:
      return labels.legacyDm;
    case 6:
      return labels.repost;
    case 7:
      return labels.reaction;
    case 42:
      return labels.channelMessage;
    case 1059:
      return labels.giftWrap;
    case 30023:
      return labels.longForm;
    default:
      return labels.unknown;
  }
}
