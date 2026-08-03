<!--
  SA4E-85 — ActionableDiff Component (Task 5.1, 5.5).
  Unified diff view with syntax highlighting (+ green, - red).
  Shows status badge, stale warning (BR-06), and action buttons.
  Accept/Reject/Regenerate buttons dispatch messages to Extension Host.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { acceptDiff, rejectDiff, regeneratePatch } from '../postMessage';

  /** Unique diff identifier */
  export let diffId: string;
  /** Target file path */
  export let filePath: string;
  /** Unified diff patch content */
  export let patch: string;
  /** Current diff status */
  export let status: 'pending' | 'applied' | 'rejected' | 'stale' | 'conflict' = 'pending';
  /** Timestamp when patch was generated */
  export let generatedAt: number = Date.now();

  /** Staleness threshold: 5 minutes (BR-06) */
  const STALE_MS = 5 * 60 * 1000;

  let isStale = false;
  let staleTimer: ReturnType<typeof setInterval> | null = null;

  $: diffLines = parseDiffLines(patch);
  $: showRegenerate = status === 'conflict';
  $: isActionable = status === 'pending' || status === 'stale';

  onMount(() => {
    checkStaleness();
    // Re-check staleness every 30 seconds
    staleTimer = setInterval(checkStaleness, 30_000);
  });

  onDestroy(() => {
    if (staleTimer) clearInterval(staleTimer);
  });

  /** Check if patch exceeds staleness threshold (BR-06) */
  function checkStaleness(): void {
    const elapsed = Date.now() - generatedAt;
    isStale = elapsed > STALE_MS;
  }

  /** Handle Accept button click */
  function handleAccept(): void {
    acceptDiff(diffId, filePath, patch);
  }

  /** Handle Reject button click */
  function handleReject(): void {
    rejectDiff(diffId);
  }

  /** Handle Regenerate button click (BR-07) */
  function handleRegenerate(): void {
    regeneratePatch(diffId, filePath);
  }

  /** Parse diff text into typed line objects for rendering */
  function parseDiffLines(text: string): DiffLine[] {
    return text.split('\n').map(classifyLine);
  }

  /** Classify a single diff line by its prefix */
  function classifyLine(line: string): DiffLine {
    if (line.startsWith('+')) return { text: line, type: 'added' };
    if (line.startsWith('-')) return { text: line, type: 'removed' };
    if (line.startsWith('@@')) return { text: line, type: 'hunk' };
    return { text: line, type: 'context' };
  }

  interface DiffLine {
    text: string;
    type: 'added' | 'removed' | 'hunk' | 'context';
  }
</script>

<div class="actionable-diff" role="region" aria-label="Code diff for {filePath}">
  <!-- Header: file path + status badge -->
  <div class="diff-header">
    <span class="file-path" title={filePath}>{filePath}</span>
    <span class="status-badge status-{status}">{status}</span>
  </div>

  <!-- Stale warning banner (BR-06) -->
  {#if isStale && isActionable}
    <div class="stale-warning" role="alert" aria-live="polite">
      ⚠ Patch may be outdated
    </div>
  {/if}

  <!-- Diff content with syntax highlighting -->
  <div class="diff-content">
    <pre class="diff-text">{#each diffLines as line}<span
        class="diff-line line-{line.type}"
      >{line.text}</span>{'\n'}{/each}</pre>
  </div>

  <!-- Action buttons footer -->
  <div class="diff-actions">
    {#if isActionable}
      <button
        class="btn btn-accept"
        on:click={handleAccept}
        aria-label="Accept diff for {filePath}"
      >
        ✓ Accept
      </button>
      <button
        class="btn btn-reject"
        on:click={handleReject}
        aria-label="Reject diff for {filePath}"
      >
        ✗ Reject
      </button>
    {/if}

    {#if showRegenerate}
      <button
        class="btn btn-regenerate"
        on:click={handleRegenerate}
        aria-label="Regenerate patch for {filePath}"
      >
        ↻ Regenerate
      </button>
    {/if}
  </div>
</div>

<style>
  .actionable-diff {
    margin: 6px 0;
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 4px;
    overflow: hidden;
  }
  .diff-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: var(--vscode-editor-background, #1e1e1e);
    border-bottom: 1px solid var(--vscode-panel-border, #333);
  }
  .file-path {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    color: var(--vscode-foreground, #ccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .status-pending {
    background: var(--vscode-progressBar-background, #0078d4);
    color: #fff;
  }
  .status-applied {
    background: var(--vscode-testing-iconPassed, #388a34);
    color: #fff;
  }
  .status-rejected {
    background: var(--vscode-descriptionForeground, #888);
    color: #fff;
  }
  .status-stale {
    background: var(--vscode-editorWarning-foreground, #cca700);
    color: #000;
  }
  .status-conflict {
    background: var(--vscode-testing-iconFailed, #f14c4c);
    color: #fff;
  }
  .stale-warning {
    padding: 4px 10px;
    background: var(--vscode-inputValidation-warningBackground, #352a05);
    border-bottom: 1px solid var(--vscode-editorWarning-foreground, #cca700);
    color: var(--vscode-editorWarning-foreground, #cca700);
    font-size: 11px;
  }
  .diff-content {
    max-height: 400px;
    overflow-y: auto;
    background: var(--vscode-editor-background, #1e1e1e);
    padding: 8px 10px;
  }
  .diff-text {
    margin: 0;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .diff-line {
    display: block;
  }
  .line-added {
    background: rgba(40, 167, 69, 0.15);
    color: var(--vscode-gitDecoration-addedResourceForeground, #81b88b);
  }
  .line-removed {
    background: rgba(220, 53, 69, 0.15);
    color: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
  }
  .line-hunk {
    color: var(--vscode-descriptionForeground, #888);
    font-style: italic;
  }
  .line-context {
    color: var(--vscode-editor-foreground, #d4d4d4);
  }
  .diff-actions {
    display: flex;
    gap: 8px;
    padding: 8px 10px;
    background: var(--vscode-editor-background, #1e1e1e);
    border-top: 1px solid var(--vscode-panel-border, #333);
  }
  .btn {
    padding: 4px 12px;
    border: none;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 150ms;
  }
  .btn:hover {
    opacity: 0.85;
  }
  .btn:focus-visible {
    outline: 2px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }
  .btn-accept {
    background: var(--vscode-testing-iconPassed, #388a34);
    color: #fff;
  }
  .btn-reject {
    background: var(--vscode-testing-iconFailed, #f14c4c);
    color: #fff;
  }
  .btn-regenerate {
    background: var(--vscode-editorWarning-foreground, #cca700);
    color: #000;
  }
</style>
