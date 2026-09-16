import { describe, expect, it } from 'vitest';
import { decideKeyRecovery, type RecoveryUiState } from './key-recovery.js';

describe('decideKeyRecovery', () => {
  const allStates: RecoveryUiState[] = [
    'running',
    'partitioned',
    'denied',
    'granted',
    'noKeyExists',
    'unsupported',
  ];

  it('never waits when the key is already readable', () => {
    for (const state of allStates) {
      expect(decideKeyRecovery(true, state)).toBe('available');
    }
  });

  // WebKit ではユーザーがタップするまで鍵が見えない。ここで待たずに NO_KEY を
  // 返すと、許可した頃には親があきらめている。
  it('waits while storage access can still be granted', () => {
    expect(decideKeyRecovery(false, 'partitioned')).toBe('wait');
    expect(decideKeyRecovery(false, 'denied')).toBe('wait');
  });

  // 待っても親のリクエストタイムアウト内に解決しないケースは早く諦める。
  it('gives up immediately when recovery cannot happen in time', () => {
    expect(decideKeyRecovery(false, 'noKeyExists')).toBe('unrecoverable');
    expect(decideKeyRecovery(false, 'unsupported')).toBe('unrecoverable');
  });

  // 待機は「ユーザーが決着させられるカードがある」ことが前提。`running` はカードを
  // 描画せず、`granted` は成功表示で操作を促さないため、待つと誰も解決できない。
  it('does not wait in states where the user has no way to settle it', () => {
    expect(decideKeyRecovery(false, 'running')).toBe('unrecoverable');
    expect(decideKeyRecovery(false, 'granted')).toBe('unrecoverable');
  });
});
