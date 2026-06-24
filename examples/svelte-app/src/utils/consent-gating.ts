import { type ConsentRequest, isDecryptMethod } from 'nosskey-iframe';
import type {
  ConsentDecision,
  ConsentPolicy,
  PolicyKey,
  TrustedOriginEntry,
} from '../store/app-state.js';

/** ダイアログ表示前の判定結果。 */
export type ConsentEvaluation =
  | { decision: 'approve'; reason: 'policy-always' | 'trusted-origin' }
  | { decision: 'reject'; reason: 'policy-deny' }
  | { decision: 'ask' };

/**
 * メソッド名を `ConsentPolicy` のキーへマップする。
 * `getPublicKey` / `getRelays` はオリジン単位の接続承認（ペアリング）として
 * `connect` に集約され、`nip44_encrypt` / `nip44_decrypt` は `nip44` に、
 * `nip04_*` も同様に集約される。`signEvent` のみ単独。
 *
 * 全分岐を網羅。`NosskeyMethod` の union に新値が追加されたら
 * `default` の `never` 代入で TS コンパイルエラーになる。
 * これにより新メソッド追加時のサイレントなフォールスルーを防ぐ。
 */
export function policyKeyFor(method: ConsentRequest['method']): PolicyKey {
  switch (method) {
    case 'getPublicKey':
    case 'getRelays':
      return 'connect';
    case 'signEvent':
      return 'signEvent';
    case 'nip44_encrypt':
    case 'nip44_decrypt':
      return 'nip44';
    case 'nip04_encrypt':
    case 'nip04_decrypt':
      return 'nip04';
    default: {
      const exhaustive: never = method;
      throw new Error(`Unhandled NosskeyMethod in policyKeyFor: ${String(exhaustive)}`);
    }
  }
}

interface EvaluateContext {
  trustedOrigins: readonly TrustedOriginEntry[];
  policy: ConsentPolicy;
}

/**
 * 同意を求めるかどうかを副作用なく決定する。
 * 評価順は安全側優先:
 *   1. メソッドポリシーが `deny` → 即拒否（信頼済みオリジンより優先）
 *   2. 復号系メソッド (`nip44_decrypt` / `nip04_decrypt`) → 常にダイアログ表示
 *      （`always` ポリシー・信頼済みオリジンでもスキップしない。security audit M-1）
 *   3. メソッドポリシーが `always` → 即承認
 *   4. 信頼済みオリジン (該当メソッドが scope に含まれる) → 即承認
 *   5. それ以外 → ダイアログ表示
 *
 * 復号系を「常に確認」に固定する理由: 復号は任意の暗号文を平文化できる
 * オラクルであり、一度サイレント許可を与えると信頼済みサイトの XSS 一つで
 * 全 DM 履歴を無確認で持ち出せる。暗号化（送信内容はダイアログに表示される）
 * とは非対称な不可逆リスクのため、復号だけはバケット (`nip44` / `nip04`) の
 * `always`・信頼済みオリジンの対象外とし、`deny` のみ短絡を許す。
 */
export function evaluateConsent(
  request: Pick<ConsentRequest, 'origin' | 'method'>,
  context: EvaluateContext
): ConsentEvaluation {
  const key = policyKeyFor(request.method);
  const decision: ConsentDecision = context.policy[key] ?? 'ask';
  if (decision === 'deny') return { decision: 'reject', reason: 'policy-deny' };

  // 復号系は `always` / 信頼済みオリジンによるサイレント承認を許さない（M-1）。
  if (isDecryptMethod(request.method)) return { decision: 'ask' };

  if (decision === 'always') return { decision: 'approve', reason: 'policy-always' };

  const trusted = context.trustedOrigins.find(
    (entry) => entry.origin === request.origin && entry.methods.includes(key)
  );
  if (trusted) return { decision: 'approve', reason: 'trusted-origin' };

  return { decision: 'ask' };
}
