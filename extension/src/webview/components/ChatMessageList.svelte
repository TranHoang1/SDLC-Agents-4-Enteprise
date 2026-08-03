<!--
  SA4E-85 — ChatMessageList (Task 2.3).
  Virtualized message list that renders only visible messages + 5 buffer.
  Auto-scrolls to bottom on new messages unless user has scrolled up.
  Keyed by message.id for stable DOM recycling (BR-18).
-->
<script lang="ts">
  import { onMount, onDestroy, afterUpdate, tick } from 'svelte';
  import { messages, isStreaming } from '../stores/chatStore';
  import { computeVisibleRange } from './virtualScroll';
  import type { VirtualScrollRange } from './virtualScroll';
  import type { ChatMessageItem } from '../stores/chatStore';
  import ChatMessage from './ChatMessage.svelte';

  /** Estimated height per message row in pixels */
  const ITEM_HEIGHT = 80;
  /** Buffer items above/below viewport (BR-18) */
  const BUFFER_SIZE = 5;

  let viewport: HTMLDivElement;
  let viewportHeight = 0;
  let scrollTop = 0;
  let userScrolledUp = false;
  let range: VirtualScrollRange = {
    startIndex: 0, endIndex: -1, offsetTop: 0, totalHeight: 0,
  };

  /** Currently active thinking message ID (for ThinkingBlock) */
  let thinkingMessageId: string | null = null;

  /** Visible slice of messages for rendering */
  let visibleMessages: ChatMessageItem[] = [];

  /** Recompute visible range when scroll or messages change */
  function recalculate(msgs: ChatMessageItem[]): void {
    range = computeVisibleRange({
      totalItems: msgs.length,
      itemHeight: ITEM_HEIGHT,
      viewportHeight,
      scrollTop,
      bufferSize: BUFFER_SIZE,
    });

    visibleMessages = range.endIndex >= range.startIndex
      ? msgs.slice(range.startIndex, range.endIndex + 1)
      : [];
  }

  function handleScroll(): void {
    if (!viewport) return;
    scrollTop = viewport.scrollTop;
    // Detect if user scrolled away from bottom (> 50px threshold)
    const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 50;
    userScrolledUp = !atBottom;
    recalculate($messages);
  }

  /** Scroll to bottom of the list */
  async function scrollToBottom(): Promise<void> {
    await tick();
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }

  // Auto-scroll when new messages arrive (unless user scrolled up)
  $: if ($messages.length > 0 && !userScrolledUp) {
    scrollToBottom();
  }

  // Recalculate when messages change
  $: recalculate($messages);

  // Track streaming state for thinking block
  $: if ($isStreaming && $messages.length > 0) {
    thinkingMessageId = $messages[$messages.length - 1]?.id ?? null;
  } else {
    thinkingMessageId = null;
  }

  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    viewportHeight = viewport.clientHeight;
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewportHeight = entry.contentRect.height;
        recalculate($messages);
      }
    });
    resizeObserver.observe(viewport);
    recalculate($messages);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });

  afterUpdate(() => {
    // Ensure scroll sticks to bottom during active streaming
    if ($isStreaming && !userScrolledUp && viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  });
</script>

<div
  class="message-list"
  bind:this={viewport}
  on:scroll={handleScroll}
  role="log"
  aria-label="Chat messages"
  aria-live="polite"
>
  {#if $messages.length === 0}
    <p class="empty-state">No messages yet. Start a conversation.</p>
  {:else}
    <!-- Top spacer for virtual scroll offset -->
    <div style="height: {range.offsetTop}px" aria-hidden="true"></div>

    {#each visibleMessages as msg (msg.id)}
      <ChatMessage
        message={msg}
        isThinking={msg.id === thinkingMessageId}
      />
    {/each}

    <!-- Bottom spacer to maintain total scroll height -->
    <div
      style="height: {range.totalHeight - range.offsetTop - ((range.endIndex - range.startIndex + 1) * ITEM_HEIGHT)}px"
      aria-hidden="true"
    ></div>
  {/if}
</div>

<style>
  .message-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 0;
    scroll-behavior: smooth;
  }
  .empty-state {
    padding: 24px 16px;
    text-align: center;
    font-size: 13px;
    opacity: 0.6;
    color: var(--vscode-descriptionForeground);
  }
</style>
