<script lang="ts">
import { completeOnTimeout, createRxBackwardReq, latest, uniq } from 'rx-nostr';
import type { NostrEvent, PWKBlob } from '../../../../src/types.js';
import { i18n } from '../i18n/i18nStore.js';
import { getPWKManager } from '../services/pwkManager.service.js';
import * as appState from '../store/appState.js';
import { relayService } from '../store/relayStore.js';

// 状態変数
let displayName = $state('');
let name = $state('');
let about = $state('');
let website = $state('');
let picture = $state('');

let isLoading = $state(false);
let saveMessage = $state('');
let currentPublicKey = $state('');

// PWKManagerのシングルトンインスタンスを取得
const pwkManager = getPWKManager();

// publicKeyストアを監視（設定変更時など）
appState.publicKey.subscribe((value) => {
  if (value) {
    currentPublicKey = value;
    loadProfile();
  }
});

// プロフィールデータを読み込み
async function loadProfile() {
  if (!currentPublicKey) {
    return;
  }

  isLoading = true;
  saveMessage = '';

  try {
    // リレーからkind:0（メタデータ）のイベントを取得する
    // まず既存のkind:0のイベントを検索
    // RxBackwardReqオブジェクトを取得
    const req = createRxBackwardReq();

    // 受信したイベントを格納する変数
    const receivedEvents: NostrEvent[] = [];

    // イベント取得のサブスクリプション
    const subscription = relayService
      .getRxNostr()
      .use(req)
      .pipe(
        uniq(), // ユニークなイベントのみ
        latest(), // 最新のイベントのみ
        completeOnTimeout(5000) // 5秒後にタイムアウト
      )
      .subscribe({
        next: (packet) => {
          if (packet?.event) {
            // イベントを保存
            receivedEvents.push(packet.event);

            try {
              // contentがJSONオブジェクトの場合のみ処理
              if (packet.event.content) {
                const metadata = JSON.parse(packet.event.content);

                // メタデータから値を設定
                displayName = metadata.display_name || metadata.displayName || '';
                name = metadata.name || '';
                about = metadata.about || '';
                website = metadata.website || '';
                picture = metadata.picture || '';
              }
            } catch (e) {
              console.error('メタデータのパースに失敗:', e);
            }
          }
        },
        complete: () => {
          console.log('リレーからの応答完了。取得結果:', receivedEvents.length, '件');

          // completeは呼ばれないかもしれないが、呼ばれた場合のために処理を残しておく
          if (receivedEvents.length === 0) {
            console.log('リレーからメタデータが取得できませんでした');
          }

          isLoading = false;
        },
        error: (err) => {
          console.error('プロフィール取得エラー:', err);
          isLoading = false;
        },
      });

    // クエリの実行
    req.emit([
      {
        kinds: [0],
        authors: [currentPublicKey],
        limit: 1,
      },
    ]); // リクエストを実際に送信

    // タイムアウト処理はcompleteOnTimeoutオペレータで自動的に行われる
  } catch (error) {
    console.error('プロフィール取得エラー:', error);
    isLoading = false;
  }
}

// プロフィールを保存
async function saveProfile() {
  isLoading = true;
  saveMessage = '';

  try {
    // サブスクライブしている値を取得
    let pwkValue: PWKBlob | null = null;

    // 一時的なサブスクリプションを作成して値を取得
    const unsubPwk = appState.pwkBlob.subscribe((value) => {
      pwkValue = value;
    });

    // サブスクリプションを解除
    unsubPwk();

    if (!currentPublicKey || !pwkValue) {
      throw new Error('認証情報が見つかりません');
    }

    // メタデータオブジェクトの作成
    const metadata = {
      name: name,
      display_name: displayName,
      about: about,
      website: website,
      picture: picture,
    };

    // メタデータイベントの作成 (kind:0)
    const event: NostrEvent = {
      kind: 0,
      content: JSON.stringify(metadata),
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    // イベントに署名（credentialIdはpwkValueから取得されるため不要）
    const signedEvent = await pwkManager.signEventWithPWK(event, pwkValue);

    // 署名したイベントをリレーに送信
    await relayService.publishEvent(signedEvent);

    saveMessage = $i18n.t.nostr.profile.saved;

    // 3秒後にメッセージをクリア
    setTimeout(() => {
      saveMessage = '';
    }, 3000);
  } catch (error) {
    console.error('プロフィール保存エラー:', error);
    saveMessage = `エラー: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isLoading = false;
  }
}
</script>

<div class="profile-editor">
  <h2>{$i18n.t.nostr.profile.title}</h2>

  {#if isLoading}
    <div class="loading">{$i18n.t.nostr.profile.loading}</div>
  {:else}
    <div class="form">
      <div class="form-group">
        <label for="displayName">{$i18n.t.nostr.profile.displayName}</label>
        <input
          type="text"
          id="displayName"
          bind:value={displayName}
          placeholder={$i18n.t.nostr.profile.displayNamePlaceholder}
        />
      </div>

      <div class="form-group">
        <label for="name">{$i18n.t.nostr.profile.username}</label>
        <input
          type="text"
          id="name"
          bind:value={name}
          placeholder={$i18n.t.nostr.profile.usernamePlaceholder}
        />
      </div>

      <div class="form-group">
        <label for="about">{$i18n.t.nostr.profile.about}</label>
        <textarea
          id="about"
          bind:value={about}
          placeholder={$i18n.t.nostr.profile.aboutPlaceholder}
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="website">{$i18n.t.nostr.profile.website}</label>
        <input
          type="text"
          id="website"
          bind:value={website}
          placeholder={$i18n.t.nostr.profile.websitePlaceholder}
        />
      </div>

      <div class="form-group">
        <label for="picture">{$i18n.t.nostr.profile.picture}</label>
        <input
          type="text"
          id="picture"
          bind:value={picture}
          placeholder={$i18n.t.nostr.profile.picturePlaceholder}
        />
      </div>

      <button class="save-button" onclick={saveProfile} disabled={isLoading}>
        {$i18n.t.nostr.profile.save}
      </button>

      {#if saveMessage}
        <div class="save-message">
          {saveMessage}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .profile-editor {
    background-color: #fff;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-top: 20px;
  }

  h2 {
    margin-top: 0;
    margin-bottom: 15px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
  }

  .loading {
    text-align: center;
    padding: 20px;
    color: #666;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  label {
    font-weight: bold;
    font-size: 0.9rem;
  }

  input,
  textarea {
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  textarea {
    resize: vertical;
  }

  .save-button {
    background-color: #5755d9;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    margin-top: 10px;
  }

  .save-button:hover {
    background-color: #4240b3;
  }

  .save-button:disabled {
    background-color: #ccc;
  }

  .save-message {
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
    text-align: center;
  }
</style>
