<!--
  SA4E-85 — TerminalLogBlock (Task 4.2).
  Streaming shell output area with monospace font, 300px max-height,
  auto-scroll, expandable/collapsible with summary on completion.
-->
<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { ArtifactLink } from '../../chat/tools';
  import ArtifactLinkButton from './ArtifactLinkButton.svelte';

  /** Full streaming output text */
  export let output: string = '';
  /** Whether the shell command is still running */
  export let isRunning: boolean = true;
  /** Exit code from shell (null while running) */
  export let exitCode: number | null = null;
  /** Execution duration in milliseconds */
  export let durationMs: number = 0;
  /** Detected artifact links from output */
  export let artifacts: ArtifactLink[] = [];

  let expanded = true;
  let autoScroll = true;
  let scrollContainer: HTMLElement;

  // Auto-collapse on completion
  $: if (!isRunning && expanded) {
    expanded = false;
  }

  $: summaryLines = getLastLines(output, 3);
  $: durationLabel = formatDuration(durationMs);

  onMount(() => {
    expanded = true;
  });

  afterUpdate(() => {
    if (autoScroll && scrollContainer && expanded) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  });

  function handleScroll(): void {
    if (!scrollContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    // Disable auto-scroll if user scrolled up
    autoScroll = scrollHeight - scrollTop - clientHeight < 30;
  }

  function toggleExpand(): void {
    expanded = !expanded;
    if (expanded) autoScroll = true;
  }

  function getLastLines(text: string, count: number): string {
    const lines = text.trim().split('\n');
    return lines.slice(-count).join('\n');
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
</script>

<div class="terminal-log-block" role="log" aria-label="Terminal output">
  <!-- Collapsed summary header -->
  <button
    class="terminal-header"
    aria-expanded={expanded}
    on:click={toggleExpand}
    on:keydown={(e) => e.key === 'Enter' && toggleExpand()}
  >
    <span class="terminal-icon" aria-hidden="true">⌨</span>

    {#if !isRunning}
      <span class="exit-badge" class:success={exitCode === 0} class:error={exitCode !== 0}>
        exit {exitCode ?? '?'}
      </span>
      <span class="duration">{durationLabel}</span>
    {:else}
      <span class="running-label">Running...</span>
    {/if}

    <span class="chevron" class:open={expanded}>▸</span>
  </button>

  <!-- Expanded log output -->
  {#if expanded}
    <div
      class="terminal-output"
      bind:this={scrollContainer}
      on:scroll={handleScroll}
      transition:slide={{ duration: 150 }}
    >
      <pre class="terminal-text">{output || 'Waiting for output...'}</pre>
    </div>
  {:else if !isRunning}
    <!-- Collapsed summary: last 3 lines + artifacts -->
    <div class="terminal-summary">
      <pre class="summary-text">{summaryLines}</pre>
      {#if artifacts.length > 0}
        <div class="artifact-row">
          {#each artifacts as artifact (artifact.path)}
            <ArtifactLinkButton label={artifact.label} path={artifact.path} type={artifact.type} />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .terminal-log-block {
    margin: 4px 0;
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 4px;
    overflow: hidden;
  }
  .terminal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    width: 100%;
    border: none;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-foreground, #ccc);
    cursor: pointer;
    font-size: 12px;
    text-align: left;
  }
  .terminal-header:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
  }
  .terminal-header:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }
  .exit-badge {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
  }
  .exit-badge.success {
    background: var(--vscode-testing-iconPassed, #388a34);
    color: #fff;
  }
  .exit-badge.error {
    background: var(--vscode-testing-iconFailed, #f14c4c);
    color: #fff;
  }
  .duration {
    color: var(--vscode-descriptionForeground, #888);
    font-size: 11px;
  }
  .running-label {
    color: var(--vscode-progressBar-background, #0078d4);
    font-style: italic;
  }
  .chevron {
    margin-left: auto;
    transition: transform 150ms ease;
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .terminal-output {
    max-height: 300px;
    overflow-y: auto;
    background: var(--vscode-terminal-background, #1e1e1e);
    padding: 8px 10px;
  }
  .terminal-text {
    margin: 0;
    font-family: var(--vscode-terminal-font-family, 'Courier New', monospace);
    font-size: var(--vscode-terminal-font-size, 12px);
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--vscode-terminal-foreground, #ccc);
  }
  .terminal-summary {
    padding: 6px 10px;
    background: var(--vscode-editor-background, #1e1e1e);
  }
  .summary-text {
    margin: 0;
    font-family: var(--vscode-terminal-font-family, monospace);
    font-size: 11px;
    line-height: 1.4;
    color: var(--vscode-descriptionForeground, #888);
    white-space: pre-wrap;
  }
  .artifact-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
</style>
