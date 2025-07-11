import { type RxNostr, createRxBackwardReq, createRxNostr, noopVerifier, uniq } from 'rx-nostr';
import type { Observable, Subscription } from 'rxjs';
import { type Writable, get, writable } from 'svelte/store';
import type { NostrEvent } from '../../../../src/types.js';
import {
  GLOBAL_FEED_SOURCES_HEX,
  followListCache,
  timelineEventsCache,
} from '../store/timeline-store.js';

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

  // タイムラインイベントを格納するStore
  public timelineEvents: Writable<NostrEvent[]> = writable([]);

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
   * イベントをクエリ（検索）
   * @param filters 検索フィルター
   * @param options オプション設定
   * @returns 検索結果のObservable
   */
  public queryEvents(
    filters: Array<{
      authors?: string[];
      kinds?: number[];
      since?: number;
      until?: number;
      limit?: number;
    }>,
    options = { uniq: true, id: 'timeline-query' }
  ): Observable<{ from: string; event: NostrEvent }> {
    const req = createRxBackwardReq();
    const source = this.rxNostr.use(req);

    if (options.uniq) {
      return source.pipe(uniq());
    }

    return source;
  }

  /**
   * タイムラインを取得（自分の投稿）
   * @param publicKey 公開鍵（16進数形式）
   * @param options オプション
   */
  public fetchTimeline(publicKey: string, options = { limit: 20 }) {
    if (!publicKey) {
      console.error('公開鍵が指定されていません');
      return;
    }

    // timelineEventsを初期化
    this.timelineEvents.set([]);

    // 直近のイベントを取得
    const req = createRxBackwardReq();

    // クエリ設定
    const subscription = this.rxNostr
      .use(req)
      .pipe(uniq())
      .subscribe({
        next: (packet) => {
          const event = packet.event;

          if (event) {
            // 新しいイベントを追加（重複チェック実装）
            this.timelineEvents.update((events) => {
              // イベントIDによる重複チェック
              const isDuplicate = events.some((e) => e.id === event.id);

              // 重複がない場合のみ追加
              if (!isDuplicate) {
                // 日付の新しい順に並べ替え
                const updatedEvents = [...events, event].sort(
                  (a, b) => (b.created_at || 0) - (a.created_at || 0)
                );

                // 上限数を超えた古いイベントを削除
                if (updatedEvents.length > options.limit) {
                  return updatedEvents.slice(0, options.limit);
                }

                return updatedEvents;
              }

              // 重複の場合は既存のイベントリストを返す
              return events;
            });
          }
        },
        error: (error) => {
          console.error('イベント取得エラー:', error);
        },
      });

    // テキスト投稿（kind:1）と特定の著者のみを対象に
    req.emit([
      {
        kinds: [1], // テキスト投稿
        authors: [publicKey],
        limit: options.limit,
      },
    ]);

    // 30秒後にサブスクリプションを終了
    setTimeout(() => {
      subscription.unsubscribe();
    }, 30000);

    return subscription;
  }

  /**
   * フォローリストを取得
   * @param targetPubkey フォローリストを取得するユーザーの公開鍵
   * @returns フォローリスト取得のPromise
   */
  public async fetchFollowList(targetPubkey: string): Promise<string[]> {
    // キャッシュをチェック
    const cachedFollows = get(followListCache)[targetPubkey];
    if (cachedFollows) {
      console.log(`Using cached follow list for ${targetPubkey}`);
      return Promise.resolve(cachedFollows);
    }

    return new Promise((resolve) => {
      if (this.relayUrls.length === 0) {
        resolve([targetPubkey]); // フォールバック
        return;
      }

      console.log(`Fetching follow list for ${targetPubkey}`);

      // フォローリスト（kind: 3）をリクエスト
      const req = createRxBackwardReq();
      const subscription = this.rxNostr
        .use(req)
        .pipe(uniq())
        .subscribe({
          next: (packet) => {
            const event = packet.event;
            if (event && event.kind === 3) {
              // フォローリストを処理
              let followedPubkeys = this.processFollowList(event);

              // フォローが空なら自分自身を追加
              if (followedPubkeys.length === 0) {
                followedPubkeys = [targetPubkey];
              }

              // キャッシュに保存
              followListCache.update((cache) => {
                return { ...cache, [targetPubkey]: followedPubkeys };
              });

              // コールバックを解決
              resolve(followedPubkeys);

              // サブスクリプションを終了
              subscription.unsubscribe();
            }
          },
          error: (error) => {
            console.error('フォローリスト取得エラー:', error);
            resolve([targetPubkey]); // エラー時はフォールバック
          },
          complete: () => {
            // データが見つからない場合もフォールバック
            const currentCache = get(followListCache);
            if (!currentCache[targetPubkey]) {
              const fallback = [targetPubkey];
              followListCache.update((cache) => {
                return { ...cache, [targetPubkey]: fallback };
              });
              resolve(fallback);
            }
          },
        });

      // kind:3のイベントを要求
      req.emit([
        {
          authors: [targetPubkey],
          kinds: [3], // フォローリスト
          limit: 1, // 最新のリストだけ必要
        },
      ]);

      // 10秒後にタイムアウト
      setTimeout(() => {
        const currentCache = get(followListCache);
        if (!currentCache[targetPubkey]) {
          const fallback = [targetPubkey];
          followListCache.update((cache) => {
            return { ...cache, [targetPubkey]: fallback };
          });
          resolve(fallback);
          subscription.unsubscribe();
        }
      }, 10000);
    });
  }

  /**
   * フォローリストを処理
   * @param event フォローリストイベント
   * @returns フォロー中のパブキーリスト
   */
  private processFollowList(event: NostrEvent): string[] {
    // pタグからパブキーを抽出
    const followedPubkeys = (event.tags || []).filter((tag) => tag[0] === 'p').map((tag) => tag[1]);

    console.log(`抽出されたフォロー: ${followedPubkeys.length} ユーザー`);

    return followedPubkeys;
  }

  /**
   * 複数のソースからフォローリストを取得
   * @param sourcePubkeys フォローリストを取得するユーザーの公開鍵の配列
   * @returns 統合されたフォローリストの配列
   */
  public async fetchFollowListsFromSources(inputPubkeys: string[]): Promise<string[]> {
    // 配列が空ならデフォルトのグローバルソース
    const sourcePubkeys = inputPubkeys.length === 0 ? GLOBAL_FEED_SOURCES_HEX : inputPubkeys;

    let allFollows: string[] = [];

    // 各ソースからフォローリストを取得して統合
    for (const pubkey of sourcePubkeys) {
      try {
        const follows = await this.fetchFollowList(pubkey);
        allFollows = [...allFollows, ...follows];
      } catch (error) {
        console.error(`${pubkey}のフォローリスト取得エラー:`, error);
      }
    }

    // 重複を除去
    allFollows = [...new Set(allFollows)];

    // ソース自体もフォローリストに含める
    for (const pubkey of sourcePubkeys) {
      if (!allFollows.includes(pubkey)) {
        allFollows.push(pubkey);
      }
    }

    return allFollows;
  }

  /**
   * ユーザーグループの投稿を取得
   * @param authors 投稿を取得するユーザーの公開鍵配列
   * @param options オプション
   */
  public fetchPostsFromUsers(
    authors: string[],
    options: { limit: number; forceRefresh: boolean } = { limit: 50, forceRefresh: false }
  ): Subscription {
    if (authors.length === 0) {
      console.error('著者が指定されていません');
      return {} as Subscription;
    }

    if (options.forceRefresh) {
      // timelineEventsを初期化
      this.timelineEvents.set([]);
    }

    // 直近のイベントを取得
    const req = createRxBackwardReq();

    // クエリ設定
    const subscription = this.rxNostr
      .use(req)
      .pipe(uniq())
      .subscribe({
        next: (packet) => {
          const event = packet.event;
          if (event) {
            // 新しいイベントを追加（重複チェック実装）
            this.timelineEvents.update((events) => {
              // イベントIDによる重複チェック
              const isDuplicate = events.some((e) => e.id === event.id);

              // 重複がない場合のみ追加
              if (!isDuplicate) {
                // 日付の新しい順に並べ替え
                const updatedEvents = [...events, event].sort(
                  (a, b) => (b.created_at || 0) - (a.created_at || 0)
                );

                // 上限数を超えた古いイベントを削除
                if (updatedEvents.length > options.limit) {
                  return updatedEvents.slice(0, options.limit);
                }

                return updatedEvents;
              }

              // 重複の場合は既存のイベントリストを返す
              return events;
            });
          }
        },
        error: (error) => {
          console.error('イベント取得エラー:', error);
        },
      });

    // テキスト投稿（kind:1）のリクエスト
    req.emit([
      {
        kinds: [1], // テキスト投稿
        authors: authors,
        limit: options.limit,
      },
    ]);

    // 30秒後にサブスクリプションを終了
    setTimeout(() => {
      subscription.unsubscribe();
    }, 30000);

    return subscription;
  }

  /**
   * モードに応じたタイムライン取得
   * @param mode タイムラインモード（'global'または'user'）
   * @param currentUserPubkey 現在のユーザー公開鍵
   * @param options オプション
   */
  public async fetchTimelineByMode(
    mode: 'global' | 'user',
    currentUserPubkey: string | null,
    options: { limit: number; forceRefresh: boolean } = { limit: 50, forceRefresh: false }
  ): Promise<Subscription> {
    console.log(`Fetching timeline in ${mode} mode for ${currentUserPubkey || 'anonymous'}`);

    // globalモードの場合は複数の固定ソースを使用
    if (mode === 'global') {
      // グローバルフィードの場合はハードコードされたソースを使用
      const followedPubkeys = await this.fetchFollowListsFromSources(GLOBAL_FEED_SOURCES_HEX);
      console.log(`Global timeline with ${followedPubkeys.length} sources`);
      return this.fetchPostsFromUsers(followedPubkeys, options);
    }

    // userモードの場合は現在のユーザーを使用
    if (mode === 'user' && currentUserPubkey) {
      // フォローリスト取得
      const followedPubkeys = await this.fetchFollowList(currentUserPubkey);
      console.log(`User timeline with ${followedPubkeys.length} sources`);
      return this.fetchPostsFromUsers(followedPubkeys, options);
    }

    // それ以外の場合は空のタイムライン
    console.error('無効なモードまたは公開鍵がありません');
    this.timelineEvents.set([]);
    return {} as Subscription;
  }

  /**
   * RxNostrインスタンスを取得
   */
  public getRxNostr(): RxNostr {
    return this.rxNostr;
  }
}
