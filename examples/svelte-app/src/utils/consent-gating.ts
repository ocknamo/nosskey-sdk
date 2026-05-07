import type { ConsentRequest } from 'nosskey-iframe';
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
 * `nip44_encrypt` / `nip44_decrypt` は `nip44` に集約され、
 * `nip04_*` も同様。`signEvent` のみ単独。
 *
 * 全分岐を網羅。`NosskeyMethod` の union に新値が追加されたら
 * `default` の `never` 代入で TS コンパイルエラーになる。
 * これにより新メソッド追加時のサイレントなフォールスルーを防ぐ。
 *
 * 非 consent メソッド (`getPublicKey` / `getRelays`) はそもそも
 * `onConsent` に到達しないが、防御的に throw する。
 */
export function policyKeyFor(method: ConsentRequest['method']): PolicyKey {
  switch (method) {
    case 'signEvent':
      return 'signEvent';
    case 'nip44_encrypt':
    case 'nip44_decrypt':
      return 'nip44';
    case 'nip04_encrypt':
    case 'nip04_decrypt':
      return 'nip04';
    case 'getPublicKey':
    case 'getRelays':
      throw new Error(`policyKeyFor called with non-consent method: ${method}`);
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
 *   2. メソッドポリシーが `always` → 即承認
 *   3. 信頼済みオリジン (該当メソッドが scope に含まれる) → 即承認
 *   4. それ以外 → ダイアログ表示
 */
export function evaluateConsent(
  request: Pick<ConsentRequest, 'origin' | 'method'>,
  context: EvaluateContext
): ConsentEvaluation {
  const key = policyKeyFor(request.method);
  const decision: ConsentDecision = context.policy[key] ?? 'ask';
  if (decision === 'deny') return { decision: 'reject', reason: 'policy-deny' };
  if (decision === 'always') return { decision: 'approve', reason: 'policy-always' };

  const trusted = context.trustedOrigins.find(
    (entry) => entry.origin === request.origin && entry.methods.includes(key)
  );
  if (trusted) return { decision: 'approve', reason: 'trusted-origin' };

  return { decision: 'ask' };
}
