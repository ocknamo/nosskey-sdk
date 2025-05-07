<script lang="ts">
import { completeOnTimeout, createRxBackwardReq, latest, uniq } from 'rx-nostr';
import type { NostrEvent, PWKBlob } from '../../../../src/types.js';
import { i18n } from '../i18n/i18n-store.js';
import { getPWKManager } from '../services/pwkManager.service.js';
import * as appState from '../store/appState.js';
import { relayService } from '../store/relayStore.js';

// 状態変数
let displayName = $state('');
let name = $state('');
let about = $state('');
let website = $state('');
let picture = $state('');

// LocalStorageキーのプレフィックス
const STORAGE_PREFIX = 'nosskey_profile_';

let isLoading = $state(false);
let saveMessage = $state('');
let currentPublicKey = $state('');

// PWKManagerのシングルトンインスタンスを取得
const pwkManager = getPWKManager();

// publicKeyストアを監視（設定変更時など）
appState.publicKey.subscribe((value) => {
  if (value) {
    currentPublicKey = value;
    // まずLocalStorageから読み込み（この時点ではisLoadingをtrueにしない）
    const hasLocalData = loadLocalProfile();
    // その後リレーからも取得（LocalStorageの読み込み結果を渡す）
    loadProfile(hasLocalData);
  }
});

// LocalStorageからプロフィール情報を読み込む
function loadLocalProfile() {
  if (!currentPublicKey || typeof localStorage === 'undefined') {
    return false;
  }

  const profileKey = `${STORAGE_PREFIX}${currentPublicKey}`;
  const savedProfile = localStorage.getItem(profileKey);

  if (savedProfile) {
    try {
      const profile = JSON.parse(savedProfile);
      displayName = profile.displayName || '';
      name = profile.name || '';
      about = profile.about || '';
      website = profile.website || '';
      picture = profile.picture || '';
      console.log('LocalStorageからプロフィール情報を読み込みました');
      return true; // 読み込み成功
    } catch (e) {
      console.error('保存されたプロフィールの読み込みに失敗:', e);
    }
  }
  return false; // 読み込み失敗または該当データなし
}

// LocalStorageにプロフィール情報を保存
function saveLocalProfile() {
  if (!currentPublicKey || typeof localStorage === 'undefined') {
    return;
  }

  const profileKey = `${STORAGE_PREFIX}${currentPublicKey}`;
  const profile = {
    displayName,
    name,
    about,
    website,
    picture,
  };

  localStorage.setItem(profileKey, JSON.stringify(profile));
  console.log('プロフィール情報をLocalStorageに保存しました');
}

// プロフィールデータを読み込み
async function loadProfile(hasLocalData = false) {
  if (!currentPublicKey) {
    return;
  }

  // LocalStorageにデータがない場合のみ、ローディング表示を有効にする
  isLoading = !hasLocalData;
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
          } else {
            // 取得できた場合はLocalStorageにも保存
            saveLocalProfile();
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

    // LocalStorageにも保存
    saveLocalProfile();

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
