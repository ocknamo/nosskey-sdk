import { type RxNostr, createRxNostr, noopVerifier } from 'rx-nostr';
import { type Writable, writable } from 'svelte/store';
import type { NostrEvent } from '../../../../src/types.js';

export type RelayStatus = 'active' | 'connecting' | 'closed' | 'error';

export interface RelayInfo {
  url: string;
  status: RelayStatus;
  lastError?: string;
}

/**
 * リレーサービス
 * Nostrリレーとの接続、イベント送受信を管理するサービス
 */
export class RelayService {
  private rxNostr: RxNostr;
  private relayUrls: string[];

  // リレー状態を格納するStore
  public relayStatuses: Writable<{ [url: string]: RelayInfo }> = writable({});

  // 送信状態を格納するStore
  public publishStatus: Writable<string> = writable('');

  constructor(relayUrls: string[] = []) {
    // rx-nostrの初期化
    this.rxNostr = createRxNostr({
      verifier: noopVerifier, // 署名検証はスキップ（デモアプリなので簡略化）
    });
    this.relayUrls = relayUrls;

    if (relayUrls.length > 0) {
      this.setRelays(relayUrls);
    }
  }

  /**
   * リレーを設定
   */
  public setRelays(urls: string[]): void {
    this.relayUrls = urls;
    this.rxNostr.setDefaultRelays(urls);
    this.setupStatusMonitoring();
  }

  /**
   * リレーを追加
   */
  public addRelay(url: string): void {
    if (!this.relayUrls.includes(url)) {
      this.relayUrls.push(url);
      // rx-nostr v3では個別にリレーを追加する方法がないので、
      // 代わりにすべてのリレーを再設定する
      this.rxNostr.setDefaultRelays(this.relayUrls);
      this.setupRelayStatusMonitoring(url);
    }
  }

  /**
   * リレーを削除
   */
  public removeRelay(url: string): void {
    this.relayUrls = this.relayUrls.filter((u) => u !== url);
    // rx-nostr v3では個別にリレーを削除する方法がないので、
    // 代わりにすべてのリレーを再設定する
    this.rxNostr.setDefaultRelays(this.relayUrls);

    this.relayStatuses.update((statuses) => {
      const newStatuses = { ...statuses };
      delete newStatuses[url];
      return newStatuses;
    });
  }

  /**
   * リレー接続状態の監視をセットアップ
   */
  private setupStatusMonitoring(): void {
    // 既存の監視をクリア
    this.relayStatuses.set({});

    // 各リレーの監視を設定
    for (const url of this.relayUrls) {
      this.setupRelayStatusMonitoring(url);
    }
  }

  /**
   * 特定リレーの監視をセットアップ
   */
  private setupRelayStatusMonitoring(url: string): void {
    // 初期状態を設定
    this.relayStatuses.update((current) => {
      return {
        ...current,
        [url]: { url, status: 'connecting' },
      };
    });

    // 現在のrx-nostrでは個別リレーの状態監視はAPIが提供されていないため、
    // 送信時のレスポンスで状態を更新する形に変更
    // ※実際の状態監視は簡略化
    this.relayStatuses.update((current) => {
      const status: RelayStatus = 'connecting';
      return {
        ...current,
        [url]: {
          ...current[url],
          url,
          status,
        },
      };
    });
  }

  /**
   * イベントを送信
   */
  public publishEvent(event: NostrEvent, timeoutMs = 10000): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.relayUrls.length === 0) {
        this.publishStatus.set('リレーが設定されていません');
        reject(new Error('リレーが設定されていません'));
        return;
      }

      this.publishStatus.set('リレーに送信中...');
      let successCount = 0;
      const errorCount = 0;

      const subscription = this.rxNostr.send(event).subscribe({
        next: (response) => {
          console.log(`${response.from}から応答:`, response);

          // rx-nostrはOKパケットを返す
          successCount++;

          // 成功したリレーの状態を更新
          this.relayStatuses.update((current) => {
            return {
              ...current,
              [response.from]: {
                ...current[response.from],
                url: response.from,
                status: 'active',
              },
            };
          });

          this.publishStatus.set(`送信成功 (${successCount}/${this.relayUrls.length})`);

          // すべてのリレーからの応答を受信したら完了
          if (successCount + errorCount >= this.relayUrls.length) {
            subscription.unsubscribe();

            if (successCount > 0) {
              this.publishStatus.set(`${successCount}/${this.relayUrls.length} リレーに送信完了`);
              resolve(true);
            } else {
              this.publishStatus.set('すべてのリレーへの送信に失敗しました');
              resolve(false);
            }
          }
        },
        error: (error) => {
          console.error('送信エラー:', error);
          this.publishStatus.set(
            `送信エラー: ${error instanceof Error ? error.message : String(error)}`
          );
          reject(error);
        },
      });

      // タイムアウト処理
      const timeoutId = setTimeout(() => {
        if (!subscription.closed) {
          subscription.unsubscribe();

          if (successCount > 0) {
            this.publishStatus.set(
              `一部のリレーに送信完了 (${successCount}/${this.relayUrls.length})`
            );
            resolve(true);
          } else {
            this.publishStatus.set('送信タイムアウト: リレーからの応答がありませんでした');
            resolve(false);
          }
        }
      }, timeoutMs);

      // 完了時にタイムアウトをクリア
      subscription.add(() => {
        clearTimeout(timeoutId);
      });
    });
  }

  /**
   * RxNostrインスタンスを取得
   */
  public getRxNostr(): RxNostr {
    return this.rxNostr;
  }
}
