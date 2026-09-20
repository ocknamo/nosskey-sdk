import { describe, expect, it } from 'vitest';
import {
  decideKeyRecovery,
  type RecoveryUiState,
  shouldRevealOnDetection,
} from './key-recovery.js';

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

describe('shouldRevealOnDetection', () => {
  // 本題。グラントはドキュメント単位なので親は iframe を作り直さず生かし続ける。
  // 初期判定はタブ復帰のたびに走るため、ここで開くと「タブを切り替えるたびに
  // ストレージ許可のモーダルが出る」になる。
  it('does not open the iframe for states a pending request can settle', () => {
    expect(shouldRevealOnDetection('partitioned')).toBe(false);
    expect(shouldRevealOnDetection('denied')).toBe(false);
  });

  // 逆に「待っても解決しない」状態は、誰もリクエストしてくれない可能性がある。
  // セットアップへの導線を出せるのはここだけなので開く。
  it('opens the iframe when waiting for a request cannot help', () => {
    expect(shouldRevealOnDetection('noKeyExists')).toBe(true);
    expect(shouldRevealOnDetection('unsupported')).toBe(true);
  });

  it('stays closed in the healthy states', () => {
    expect(shouldRevealOnDetection('running')).toBe(false);
    expect(shouldRevealOnDetection('granted')).toBe(false);
  });

  // 「開く」と「待つ」は互いに排他。両方 false（誰も何もできない）や
  // 両方 true（待てるのに割り込む）になっていないことを全状態で固定する。
  it('is the exact complement of decideKeyRecovery for every card state', () => {
    const cardStates: RecoveryUiState[] = ['partitioned', 'denied', 'noKeyExists', 'unsupported'];
    for (const state of cardStates) {
      const waits = decideKeyRecovery(false, state) === 'wait';
      expect(shouldRevealOnDetection(state)).toBe(!waits);
    }
  });
});
