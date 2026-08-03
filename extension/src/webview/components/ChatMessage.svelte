<!--
  SA4E-85 — ChatMessage (Task 2.4).
  Individual message renderer with markdown + code block support.
  Displays user/assistant/system messages with appropriate styling.
  Includes ThinkingBlock for assistant reasoning content.
-->
<script lang="ts">
  import type { ChatMessageItem } from '../stores/chatStore';
  import ThinkingBlock from './ThinkingBlock.svelte';

  /** The message data to render */
  export let message: ChatMessageItem;
  /** Whether this message's thinking stream is currently active */
  export let isThinking: boolean = false;

  /** Format timestamp to locale time string */
  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Derive role label for accessibility */
  function roleLabel(role: string): string {
    switch (role) {
      case 'user': return 'You';
      case 'assistant': return 'Assistant';
      case 'system': return 'System';
      default: return role;
    }
  }

  /**
   * Simple markdown-to-HTML renderer for code blocks and inline formatting.
   * Handles fenced code blocks (```lang), inline code (`), bold (**), italic (*).
   * Sanitizes HTML entities to prevent XSS.
   */
  function renderMarkdown(text: string): string {
    if (!text) return '';
    // Escape HTML entities first
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced code blocks: ```lang\n...\n```
    html = html.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_match, lang, code) => {
        const langAttr = lang ? ` data-lang="${lang}"` : '';
        return `<pre class="code-block"${langAttr}><code>${code}</code></pre>`;
      }
    );

    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* (not inside bold)
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // Line breaks
    html = html.replace(/\n/g, '<br/>');

    return html;
  }
</script>

<article
  class="chat-message {message.role}"
  aria-label="{roleLabel(message.role)} message"
>
  <div class="message-meta">
    <span class="role-badge">{roleLabel(message.role)}</span>
    {#if message.agentId}
      <span class="agent-tag">{message.agentId}</span>
    {/if}
    <time class="timestamp" datetime={new Date(message.timestamp).toISOString()}>
      {formatTime(message.timestamp)}
    </time>
  </div>

  {#if message.thinking}
    <ThinkingBlock content={message.thinking} isActive={isThinking} />
  {/if}

  <div class="message-body">
    {@html renderMarkdown(message.content)}
  </div>
</article>

<style>
  .chat-message {
    padding: 8px 12px;
    margin: 2px 0;
    border-radius: 4px;
  }
  .chat-message.user {
    background: var(--vscode-input-background, rgba(255,255,255,0.04));
  }
  .chat-message.assistant {
    background: transparent;
  }
  .chat-message.system {
    background: var(--vscode-editorInfo-background, rgba(0,120,212,0.1));
    font-style: italic;
  }
  .message-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
  }
  .role-badge {
    font-weight: 600;
    text-transform: capitalize;
  }
  .agent-tag {
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    font-size: 10px;
  }
  .timestamp {
    margin-left: auto;
  }
  .message-body {
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
  }
  .message-body :global(.code-block) {
    margin: 8px 0;
    padding: 8px 12px;
    border-radius: 4px;
    background: var(--vscode-textCodeBlock-background, #1e1e1e);
    overflow-x: auto;
    font-size: 12px;
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .message-body :global(.inline-code) {
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--vscode-textCodeBlock-background, #1e1e1e);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
  }
</style>
