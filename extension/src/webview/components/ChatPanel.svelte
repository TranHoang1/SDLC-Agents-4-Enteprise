<!--
  SA4E-85 — ChatPanel (Task 2.1).
  Root chat component composing header, message list, and input.
  Handles send/command events and dispatches to Extension Host via postMessage.
  Integrates RAF stream batching for smooth token rendering.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ChatHeader from './ChatHeader.svelte';
  import ServiceOfflineWarning from './ServiceOfflineWarning.svelte';
  import ChatMessageList from './ChatMessageList.svelte';
  import ChatInput from './ChatInput.svelte';
  import { addUserMessage } from '../stores/chatStore';
  import { sendPrompt, dispatchCommand, requestSyncState } from '../postMessage';
  import { createStreamBatcher } from './streamBatcher';
  import type { StreamBatcher } from './streamBatcher';
  import { appendToken } from '../stores/chatStore';

  /**
   * RAF batcher for stream tokens — coalesces rapid token arrivals
   * into single store updates per animation frame (Task 2.6).
   */
  let batcher: StreamBatcher | null = null;
  let currentBatchMessageId: string | null = null;

  /**
   * Start batching tokens for a message.
   * Called from messageListener when STREAM_START arrives.
   */
  export function startBatching(messageId: string): void {
    disposeBatcher();
    currentBatchMessageId = messageId;
    batcher = createStreamBatcher((batch) => {
      if (currentBatchMessageId) {
        appendToken(currentBatchMessageId, batch);
      }
    });
  }

  /** Push a token into the RAF batcher */
  export function pushToken(token: string): void {
    batcher?.push(token);
  }

  /** Stop batching and flush remaining tokens */
  export function stopBatching(): void {
    disposeBatcher();
    currentBatchMessageId = null;
  }

  function disposeBatcher(): void {
    batcher?.dispose();
    batcher = null;
  }

  /** Handle send event from ChatInput */
  function handleSend(event: CustomEvent<{ text: string; agentId: string }>): void {
    const { text, agentId } = event.detail;
    // Generate unique message ID for the user message
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addUserMessage(id, text);
    sendPrompt(text, agentId);
  }

  /** Handle slash command event from ChatInput */
  function handleCommand(event: CustomEvent<{ command: string; args?: string }>): void {
    const { command, args } = event.detail;
    dispatchCommand(command, args ? { rawArgs: args } : undefined);
  }

  /**
   * SA4E-85 v3.1: Request chat-state hydration on mount so the UI shows the
   * persisted Backend KB conversation (multi-IDE hydrate).
   */
  onMount(() => {
    requestSyncState();
  });

  onDestroy(() => disposeBatcher());
</script>

<div class="chat-panel" role="main" aria-label="Chat panel">
  <ChatHeader />
  <ServiceOfflineWarning />
  <ChatMessageList />
  <ChatInput on:send={handleSend} on:command={handleCommand} />
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font-family: var(--vscode-font-family, sans-serif);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
  }
</style>
