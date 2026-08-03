<!--
  SA4E-85 — ChatInput (Task 2.2).
  Textarea with send button. Detects "/" prefix for slash commands.
  Sends SEND_PROMPT to extension host on submit (Enter or button click).
  Supports Shift+Enter for newlines.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { isStreaming } from '../stores/chatStore';
  import { selectedAgentId } from '../stores/agentStore';

  const dispatch = createEventDispatcher<{
    send: { text: string; agentId: string };
    command: { command: string; args?: string };
  }>();

  let inputText = '';
  let textarea: HTMLTextAreaElement;

  /** Whether the current input starts with "/" (slash command) */
  $: isSlashCommand = inputText.trimStart().startsWith('/');

  /** Whether the send button should be enabled */
  $: canSend = inputText.trim().length > 0 && !$isStreaming;

  /** Handle keyboard events — Enter sends, Shift+Enter inserts newline */
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  /** Submit the current input */
  function submit(): void {
    const text = inputText.trim();
    if (!text || $isStreaming) return;

    if (isSlashCommand) {
      // Parse slash command: /command args
      const parts = text.slice(1).split(/\s+/);
      const command = parts[0] ?? '';
      const args = parts.slice(1).join(' ') || undefined;
      dispatch('command', { command, args });
    } else {
      const agentId = $selectedAgentId ?? 'default';
      dispatch('send', { text, agentId });
    }

    inputText = '';
    // Reset textarea height after clearing
    if (textarea) {
      textarea.style.height = 'auto';
    }
  }

  /** Auto-resize textarea to fit content */
  function handleInput(): void {
    if (!textarea) return;
    textarea.style.height = 'auto';
    // Cap at 200px max height before scrolling
    const maxHeight = 200;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }
</script>

<div class="chat-input-container" role="form" aria-label="Message input">
  {#if isSlashCommand}
    <div class="slash-indicator" aria-live="polite">
      ⚡ Command mode
    </div>
  {/if}

  <div class="input-row">
    <textarea
      bind:this={textarea}
      bind:value={inputText}
      on:keydown={handleKeydown}
      on:input={handleInput}
      class="chat-textarea"
      class:command-mode={isSlashCommand}
      placeholder={$isStreaming ? 'Waiting for response...' : 'Type a message or /command...'}
      disabled={$isStreaming}
      rows="1"
      aria-label="Chat message input"
      aria-describedby="input-hint"
    ></textarea>

    <button
      class="send-button"
      on:click={submit}
      disabled={!canSend}
      aria-label="Send message"
      title="Send (Enter)"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 1.5L15 8L1 14.5V9.5L10 8L1 6.5V1.5Z"/>
      </svg>
    </button>
  </div>

  <span id="input-hint" class="sr-only">
    Press Enter to send, Shift+Enter for new line. Start with / for commands.
  </span>
</div>

<style>
  .chat-input-container {
    padding: 8px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-background);
  }
  .slash-indicator {
    font-size: 11px;
    color: var(--vscode-terminal-ansiYellow, #e5c07b);
    padding: 2px 0 4px;
  }
  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .chat-textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 4px;
    background: var(--vscode-input-background, #1e1e1e);
    color: var(--vscode-input-foreground, #ccc);
    padding: 8px 10px;
    font-size: 13px;
    font-family: var(--vscode-font-family, sans-serif);
    line-height: 1.4;
    min-height: 36px;
    max-height: 200px;
    overflow-y: auto;
  }
  .chat-textarea:focus {
    outline: none;
    border-color: var(--vscode-focusBorder, #007acc);
  }
  .chat-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .chat-textarea.command-mode {
    border-color: var(--vscode-terminal-ansiYellow, #e5c07b);
  }
  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 4px;
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
    cursor: pointer;
    flex-shrink: 0;
  }
  .send-button:hover:not(:disabled) {
    background: var(--vscode-button-hoverBackground, #1177bb);
  }
  .send-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .send-button:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>
