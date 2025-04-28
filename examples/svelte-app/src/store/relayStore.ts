import { RelayService } from '../services/relay.service.js';
import { defaultRelays } from './appState.js';

// シングルトンとしてリレーサービスをエクスポート
export const relayService = new RelayService(defaultRelays);
