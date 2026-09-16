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

  // 判定が終わる前 (running) / 終わった直後 (granted) に鍵が無いのは、
  // 回復の余地が残っている状態なので待つ側に倒す。
  it('waits for the states that mean detection is still in play', () => {
    expect(decideKeyRecovery(false, 'running')).toBe('wait');
    expect(decideKeyRecovery(false, 'granted')).toBe('wait');
  });
});
