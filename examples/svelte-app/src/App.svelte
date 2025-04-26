<script>
  import { onMount } from 'svelte';
  import { currentView } from './lib/stores/app-store.js';
  import { checkSupport, loadSavedCredentials, isAuthenticated } from './lib/stores/nosskey-store.js';
  
  import Header from './lib/components/Header.svelte';
  import Footer from './lib/components/Footer.svelte';
  import HomeView from './views/HomeView.svelte';
  import RegisterView from './views/RegisterView.svelte';
  import LoginView from './views/LoginView.svelte';
  import NostrView from './views/NostrView.svelte';
  
  onMount(async () => {
    // Passkey対応確認
    await checkSupport();
    
    // 保存済み認証情報の読み込み
    const hasCredentials = loadSavedCredentials();
    
    // 認証済みならNostr画面へ
    if (hasCredentials && $isAuthenticated) {
      currentView.set('nostr');
    }
  });
</script>

<div class="app">
  <Header />
  
  <main>
    {#if $currentView === 'home'}
      <HomeView />
    {:else if $currentView === 'register'}
      <RegisterView />
    {:else if $currentView === 'login'}
      <LoginView />
    {:else if $currentView === 'nostr'}
      <NostrView />
    {:else}
      <HomeView />
    {/if}
  </main>
  
  <Footer />
</div>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background-color: #ffffff;
    color: #333;
    line-height: 1.6;
  }
  
  :global(*) {
    box-sizing: border-box;
  }
  
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  
  main {
    flex: 1;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>
