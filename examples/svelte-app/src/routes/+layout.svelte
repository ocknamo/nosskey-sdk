<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import i18n from '../lib/i18n/index.js';

  // i18nから各ストアと関数を取得
  const { language, t, setLanguage, initLanguage } = i18n;

  // データプロップ（必要がなければconst宣言にして警告を回避）
  export const data = {};

  onMount(() => {
    // ブラウザの言語設定または保存された設定から言語を初期化
    initLanguage();
  });

  // 言語切り替え
  function toggleLanguage() {
    const currentLang = $language;
    const nextLang = currentLang === 'ja' ? 'en' : 'ja';
    setLanguage(nextLang);
  }
</script>

<header>
  <div class="header-content">
    <h1>{$t('app_title')}</h1>
    <div class="language-toggle">
      <button on:click={toggleLanguage} aria-label="Toggle language">
        {$language === 'ja' ? '🇯🇵' : '🇺🇸'} {$t('language')}
      </button>
    </div>
  </div>
  <nav>
    <ul>
      <li>
        <a href="/">{$t('home')}</a>
      </li>
      <li>
        <a href="/register">{$t('register')}</a>
      </li>
      <li>
        <a href="/login">{$t('login')}</a>
      </li>
      <li>
        <a href="/nostr">{$t('nostr_features')}</a>
      </li>
    </ul>
  </nav>
</header>

<main>
  <slot />
</main>

<footer>
  <p>{$t('footer_copyright')}</p>
</footer>

<style>
  header {
    padding: 1rem;
    background-color: #f0f0f0;
    margin-bottom: 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .language-toggle button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .language-toggle button:hover {
    background-color: #0056b3;
  }

  nav ul {
    display: flex;
    list-style: none;
    padding: 0;
    gap: 1rem;
  }

  nav li {
    padding: 0.5rem 1rem;
    border-radius: 4px;
  }

  nav li:hover {
    background-color: #007bff;
  }

  nav li:hover a {
    color: white;
  }

  a {
    text-decoration: none;
    color: #333;
  }

  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1rem 2rem;
  }

  footer {
    text-align: center;
    padding: 1rem;
    margin-top: 2rem;
    border-top: 1px solid #eee;
  }
</style>
