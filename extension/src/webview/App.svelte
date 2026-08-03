<!--
  SA4E-85 — Root Svelte App component.
  Mount point for the Agentic Chat UI.
  Delegates to ChatPanel which composes the full chat interface.
-->
<script lang="ts">
  import ChatPanel from './components/ChatPanel.svelte';
</script>

<main class="app-root">
  <ChatPanel />
</main>

<style>
  .app-root {
    height: 100vh;
    overflow: hidden;
  }
</style>
