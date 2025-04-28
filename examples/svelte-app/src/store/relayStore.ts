import { writable, get } from 'svelte/store';
import { RelayService } from '../services/relay.service.js';
import { defaultRelays } from './appState.js';

// 現在使用中のリレーリスト
export const activeRelays = writable<string[]>([]);

// シングルトンとしてリレーサービスをエクスポート
export const relayService = new RelayService();

// 初期化関数
function initializeRelays() {
  // ローカルストレージからリレーリストを取得、または defaultRelays を使用
  const savedRelays = localStorage.getItem("nosskey_relays");
  let relayList: string[];
  
  if (savedRelays) {
    relayList = JSON.parse(savedRelays);
  } else {
    relayList = [...defaultRelays]; // デフォルトリレーのコピーを使用
  }
  
  // リレーリストとストアを更新
  activeRelays.set(relayList);
  relayService.setRelays(relayList);
}

// リレーリストが変更されたときにリレーサービスを更新するサブスクリプション
activeRelays.subscribe(relayList => {
  relayService.setRelays(relayList);
  
  // ローカルストレージに保存
  localStorage.setItem("nosskey_relays", JSON.stringify(relayList));
});

// 初期化を実行
initializeRelays();
