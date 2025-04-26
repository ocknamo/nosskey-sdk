<script>
  import { currentView, navigateTo } from '../stores/app-store.js';
  import { isAuthenticated } from '../stores/nosskey-store.js';
</script>

<header>
  <h1>Nosskey Direct PRF Demo</h1>
  
  <nav>
    <ul>
      <li>
        <button class:active={$currentView === 'home'} on:click={() => navigateTo('home')}>
          ホーム
        </button>
      </li>
      {#if !$isAuthenticated}
        <li>
          <button class:active={$currentView === 'register'} on:click={() => navigateTo('register')}>
            パスキー登録
          </button>
        </li>
        <li>
          <button class:active={$currentView === 'login'} on:click={() => navigateTo('login')}>
            ログイン
          </button>
        </li>
      {:else}
        <li>
          <button class:active={$currentView === 'nostr'} on:click={() => navigateTo('nostr')}>
            Nostr
          </button>
        </li>
      {/if}
    </ul>
  </nav>
</header>

<style>
  header {
    background-color: #f8f9fa;
    padding: 1rem;
    border-bottom: 1px solid #e9ecef;
  }
  
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  nav {
    margin-top: 1rem;
  }
  
  ul {
    display: flex;
    list-style-type: none;
    margin: 0;
    padding: 0;
    gap: 1rem;
  }
  
  button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    border-radius: 4px;
  }
  
  button:hover {
    background-color: #e9ecef;
  }
  
  button.active {
    font-weight: bold;
    color: #4361ee;
  }
</style>
