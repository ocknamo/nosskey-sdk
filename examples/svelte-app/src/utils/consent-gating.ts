import type { ConsentRequest } from 'nosskey-iframe';
import type { ConsentDecision, ConsentPolicy } from '../store/app-state.js';

/** ダイアログ表示前の判定結果。 */
export type ConsentEvaluation =
  | { decision: 'approve'; reason: 'policy-always' | 'trusted-origin' }
  | { decision: 'reject'; reason: 'policy-deny' }
  | { decision: 'ask' };

/**
 * メソッド名を `ConsentPolicy` のキーへマップする。
 * `nip44_encrypt` / `nip44_decrypt` は `nip44` に集約され、
 * `nip04_*` も同様。`signEvent` のみ単独。
 */
export function policyKeyFor(method: ConsentRequest['method']): keyof ConsentPolicy | null {
  switch (method) {
    case 'signEvent':
      return 'signEvent';
    case 'nip44_encrypt':
    case 'nip44_decrypt':
      return 'nip44';
    case 'nip04_encrypt':
    case 'nip04_decrypt':
      return 'nip04';
    default:
      return null;
  }
}

interface EvaluateContext {
  trustedOrigins: readonly string[];
  policy: ConsentPolicy;
}

/**
 * 同意を求めるかどうかを副作用なく決定する。
 * 評価順は安全側優先:
 *   1. メソッドポリシーが `deny` → 即拒否
 *   2. メソッドポリシーが `always` → 即承認
 *   3. 信頼済みオリジン → 即承認
 *   4. それ以外 → ダイアログ表示
 */
export function evaluateConsent(
  request: Pick<ConsentRequest, 'origin' | 'method'>,
  context: EvaluateContext
): ConsentEvaluation {
  const key = policyKeyFor(request.method);
  if (key) {
    const decision: ConsentDecision = context.policy[key] ?? 'ask';
    if (decision === 'deny') return { decision: 'reject', reason: 'policy-deny' };
    if (decision === 'always') return { decision: 'approve', reason: 'policy-always' };
  }
  if (context.trustedOrigins.includes(request.origin)) {
    return { decision: 'approve', reason: 'trusted-origin' };
  }
  return { decision: 'ask' };
}
