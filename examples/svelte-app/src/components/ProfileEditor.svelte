<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { PWKManager } from "../../../../src/nosskey.js";
  import type { NostrEvent, PWKBlob } from "../../../../src/types.js";
  import { relayService } from "../store/relayStore.js";
  import { i18n } from "../i18n/i18nStore.js";
  import * as appState from "../store/appState.js";

  // 状態変数
  let displayName = $state("");
  let name = $state("");
  let about = $state("");
  let website = $state("");
  let picture = $state("");

  let isLoading = $state(false);
  let saveMessage = $state("");
  let currentPublicKey = $state("");

  // PWKManagerのインスタンスを作成
  const pwkManager = new PWKManager();

  // publicKeyストアを監視
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
    saveMessage = "";

    try {
      // リレーからkind:0（メタデータ）のイベントを取得する
      // まず既存のkind:0のイベントを検索
      const req = relayService.queryEvents([
        {
          kinds: [0],
          authors: [currentPublicKey],
          limit: 1,
        },
      ]);

      const results: Array<{ from: string; event: NostrEvent }> = [];

      // イベント取得のサブスクリプション
      const subscription = req.subscribe({
        next: (packet) => {
          if (packet && packet.event) {
            results.push(packet);
          }
        },
        complete: () => {
          // 最新のイベントを処理
          if (results.length > 0) {
            // 最新のイベントからメタデータを取得（作成日時の降順でソート）
            const latestEvent = results
              .map((r) => r.event)
              .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];

            if (latestEvent && latestEvent.content) {
              try {
                // contentはJSONオブジェクト
                const metadata = JSON.parse(latestEvent.content);
                displayName =
                  metadata.display_name || metadata.displayName || "";
                name = metadata.name || "";
                about = metadata.about || "";
                website = metadata.website || "";
                picture = metadata.picture || "";
              } catch (e) {
                console.error("メタデータのパースに失敗:", e);
              }
            }
          }

          isLoading = false;
        },
        error: (err) => {
          console.error("プロフィール取得エラー:", err);
          isLoading = false;
        },
      });

      // クエリの実行
      setTimeout(() => {
        subscription.unsubscribe();
        isLoading = false;
      }, 5000); // 5秒後にタイムアウト
    } catch (error) {
      console.error("プロフィール取得エラー:", error);
      isLoading = false;
    }
  }

  // プロフィールを保存
  async function saveProfile() {
    isLoading = true;
    saveMessage = "";

    try {
      // サブスクライブしている値を取得
      let credValue: Uint8Array | null = null;
      let pwkValue: PWKBlob | null = null;

      // 一時的なサブスクリプションを作成して値を取得
      const unsubCred = appState.credentialId.subscribe((value) => {
        credValue = value;
      });
      const unsubPwk = appState.pwkBlob.subscribe((value) => {
        pwkValue = value;
      });

      // サブスクリプションを解除
      unsubCred();
      unsubPwk();

      if (!currentPublicKey || !pwkValue || !credValue) {
        throw new Error("認証情報が見つかりません");
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

      // イベントに署名
      const signedEvent = await pwkManager.signEvent(
        event,
        pwkValue,
        credValue,
      );

      // 署名したイベントをリレーに送信
      await relayService.publishEvent(signedEvent);

      saveMessage = $i18n.t.nostr.profile.saved;

      // 3秒後にメッセージをクリア
      setTimeout(() => {
        saveMessage = "";
      }, 3000);
    } catch (error) {
      console.error("プロフィール保存エラー:", error);
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
    cursor: not-allowed;
  }

  .save-message {
    margin-top: 15px;
    padding: 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
    text-align: center;
  }
</style>
