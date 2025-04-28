<script lang="ts">
  import AuthScreen from './components/AuthScreen.svelte';
  import NostrScreen from './components/NostrScreen.svelte';
  import { currentScreen } from './store/appState.js';
  
  let screen = 'auth';
  
  // ストアの値が変更されたときに画面を切り替え
  currentScreen.subscribe(value => {
    screen = value;
  });
</script>

<div class="app-container">
  {#if screen === 'auth'}
    <AuthScreen />
  {:else if screen === 'nostr'}
    <NostrScreen />
  {/if}
</div>

<style>
  .app-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
  
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    line-height: 1.5;
    color: #333;
    background-color: #f9f9f9;
    margin: 0;
    padding: 0;
  }
</style>
