<!--
  SA4E-85 — ThinkingBlock (Task 2.5).
  Collapsible reasoning display with slide animation.
  Auto-expands on THINKING_START, auto-collapses after THINKING_END + 1s delay.
  Click header toggles override of auto behavior.
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { onDestroy } from 'svelte';

  /** The thinking/reasoning text content */
  export let content: string = '';
  /** Whether the thinking stream is currently active */
  export let isActive: boolean = false;

  let expanded = false;
  let userOverride = false;
  let collapseTimer: ReturnType<typeof setTimeout> | null = null;

  /** Handle user click — overrides auto expand/collapse */
  function handleToggle(): void {
    userOverride = true;
    expanded = !expanded;
    clearCollapseTimer();
  }

  function clearCollapseTimer(): void {
    if (collapseTimer !== null) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }
  }

  // Reactive: auto-expand when thinking starts (unless user overrode)
  $: if (isActive && !userOverride) {
    expanded = true;
    clearCollapseTimer();
  }

  // Reactive: auto-collapse 1s after thinking ends (unless user overrode)
  $: if (!isActive && expanded && !userOverride) {
    clearCollapseTimer();
    collapseTimer = setTimeout(() => {
      expanded = false;
      collapseTimer = null;
    }, 1000);
  }

  // Reset user override when a new thinking session starts
  $: if (isActive) {
    userOverride = false;
  }

  onDestroy(() => clearCollapseTimer());
</script>

{#if content}
  <div class="thinking-block" role="region" aria-label="AI reasoning">
    <button
      class="thinking-header"
      aria-expanded={expanded}
      on:click={handleToggle}
      on:keydown={(e) => e.key === 'Enter' && handleToggle()}
    >
      <span class="thinking-icon" class:active={isActive}>💭</span>
      <span class="thinking-label">
        {isActive ? 'Thinking...' : 'Reasoning'}
      </span>
      <span class="chevron" class:open={expanded}>▸</span>
    </button>

    {#if expanded}
      <div class="thinking-content" transition:slide={{ duration: 200 }}>
        <pre class="thinking-text">{content}</pre>
      </div>
    {/if}
  </div>
{/if}

<style>
  .thinking-block {
    margin: 4px 0;
    border-left: 2px solid var(--vscode-descriptionForeground, #888);
    border-radius: 2px;
  }
  .thinking-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground, #888);
    cursor: pointer;
    font-size: 12px;
    text-align: left;
  }
  .thinking-header:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
  }
  .thinking-header:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }
  .thinking-icon.active {
    animation: pulse 1.5s ease-in-out infinite;
  }
  .chevron {
    margin-left: auto;
    transition: transform 200ms ease;
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .thinking-content {
    padding: 4px 8px 8px;
  }
  .thinking-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--vscode-descriptionForeground, #888);
    font-family: var(--vscode-editor-font-family, monospace);
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
