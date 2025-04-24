import { initLanguage, language, setLanguage, t } from '../lib/i18n/index.js';

// ブラウザとサーバサイドの両方で動作するレイアウト関数
export function load() {
  // 翻訳の準備
  return {
    // 翻訳にアクセスするためのProps
    i18n: {
      t,
      language,
      setLanguage,
      initLanguage,
    },
  };
}
