<script>
  import '../app.css';
</script>

<header>
  <h1>Nosskey SDK デモアプリ</h1>
  <nav>
    <ul>
      <li>
        <a href="/">ホーム</a>
      </li>
      <li>
        <a href="/register">新規登録</a>
      </li>
      <li>
        <a href="/login">ログイン</a>
      </li>
      <li>
        <a href="/nostr">Nostr機能</a>
      </li>
    </ul>
  </nav>
</header>

<main>
  <slot />
</main>

<footer>
  <p>© 2025 Nosskey SDK Demo</p>
</footer>

<style>
  header {
    padding: 1rem;
    background-color: #f0f0f0;
    margin-bottom: 2rem;
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
