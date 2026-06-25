import { bytesToHex } from './utils.js';

/**
 * createPasskey で退避した未消費 PRF（直接モードの実秘密鍵 / wrap モードの KEK）の
 * 最大滞留時間。通常フローでは createNostrKey / importNostrKey が直後（ミリ秒〜数秒）に
 * 消費するため、TTL 経過は「消費されないまま放置された」異常経路とみなしてゼロ化する。
 */
export const PENDING_PRF_TTL_MS = 60_000;

type PendingPrfEntry = {
  standard?: Uint8Array;
  wrap?: Uint8Array;
  timer?: ReturnType<typeof setTimeout>;
};

/**
 * createPasskey 時に二重 salt eval して得た PRF を、直後の createNostrKey /
 * importNostrKey が一度だけ消費するための内部キャッシュ。
 * - key: credentialId (hex)
 * - standard: STANDARD_SALT 由来 PRF（直接モード鍵 / createNostrKey が使う）
 * - wrap: WRAP_SALT 由来 PRF（wrap モード KEK / importNostrKey が使う）
 * - timer: 未消費のまま放置された場合（例外・画面離脱）に自動ゼロ化するタイマー
 *
 * 消費時は即ゼロ化 + Map から削除する（同じパスキーでもう一度 derive したい場合は
 * 通常通り getPrfSecret() 経由で UV を要求する）。秘匿バイト（32 byte の秘密値）を
 * heap に放置しないことが本クラスの主目的なので、TTL・上書き・全消去のいずれの経路でも
 * 必ず `.fill(0)` でゼロ化してから破棄する。
 */
export class PendingPrfCache {
  #byCredId = new Map<string, PendingPrfEntry>();
  #ttlMs: number;

  constructor(ttlMs: number = PENDING_PRF_TTL_MS) {
    this.#ttlMs = ttlMs;
  }

  /**
   * create 時に得た PRF を credentialId 紐付けで退避する。standard / wrap の
   * どちらも無ければ何もしない。同一 credentialId の古いエントリが残っている場合
   * （リトライ・連続 create）はバッファをゼロ化してから上書きする。これがないと
   * 前回 PRF が GC まで heap に残る。
   *
   * create 後に createNostrKey / importNostrKey のどちらも呼ばれない経路
   * （例外・画面離脱）で 32 byte 秘密値が heap に滞留し続けないよう、TTL 経過で
   * 自動ゼロ化するタイマーを仕掛ける。
   */
  store(id: Uint8Array, prf: { standard?: Uint8Array; wrap?: Uint8Array }): void {
    if (!prf.standard && !prf.wrap) return;
    const key = bytesToHex(id);
    this.#clearEntry(key);
    const timer = setTimeout(() => this.#clearEntry(key), this.#ttlMs);
    // Node 環境ではタイマーがプロセス終了を妨げないようにする（ブラウザでは no-op）
    (timer as unknown as { unref?: () => void }).unref?.();
    this.#byCredId.set(key, {
      ...(prf.standard && { standard: prf.standard }),
      ...(prf.wrap && { wrap: prf.wrap }),
      timer,
    });
  }

  /**
   * 指定 credentialId / kind の PRF を取り出して返す。
   *
   * 正常運用では create 直後に createNostrKey か importNostrKey の **どちらか一方** しか
   * 呼ばれないため、片方を消費したタイミングで「相方」のバッファも即時ゼロ化して
   * Map エントリごと削除する（未消費の秘匿バイトを heap に放置しない）。
   * credentialId が undefined（= ユーザー選択待ち）の場合はキャッシュ照合できないので undefined を返す。
   *
   * 注意: 本メソッドは**同期のまま**保つこと。Map 取得からタイマー解除・削除までが
   * 同期で完結しているため「hit 直後・使用前に TTL タイマーが発火して値がゼロ化される」
   * 競合は起こりえない。途中に await を入れるとこの保証が壊れる。
   */
  consume(credentialId: Uint8Array | undefined, kind: 'standard' | 'wrap'): Uint8Array | undefined {
    if (!credentialId) return undefined;
    const key = bytesToHex(credentialId);
    const entry = this.#byCredId.get(key);
    if (!entry) return undefined;
    const value = entry[kind];
    if (!value) return undefined;
    // 消費したので TTL タイマーは不要になる
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    // 相方は今後使われない前提でゼロ化して破棄
    const other = kind === 'standard' ? 'wrap' : 'standard';
    entry[other]?.fill(0);
    this.#byCredId.delete(key);
    return value;
  }

  /**
   * 退避した未消費 PRF キャッシュをすべてゼロ化して破棄する。
   * 未消費エントリは TTL（{@link PENDING_PRF_TTL_MS}）経過でも自動ゼロ化されるが、
   * ログアウト・完全ワイプ時は待たずに即時掃除する。
   */
  clearAll(): void {
    for (const key of [...this.#byCredId.keys()]) {
      this.#clearEntry(key);
    }
  }

  /**
   * 単一エントリをゼロ化して破棄する（TTL 満了・上書き・全消去共通）。
   */
  #clearEntry(key: string): void {
    const entry = this.#byCredId.get(key);
    if (!entry) return;
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    entry.standard?.fill(0);
    entry.wrap?.fill(0);
    this.#byCredId.delete(key);
  }
}
