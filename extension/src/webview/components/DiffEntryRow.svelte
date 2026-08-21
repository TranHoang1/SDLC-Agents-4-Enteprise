<!--
  SA4E-183 — DiffEntryRow component.
  Displays a single file change entry with expand/collapse diff content.
  Clicking the file path opens VS Code diff editor via postMessage.
-->
<script lang="ts">
  import type { ChangeEntryPayload } from '../../chat/diff/IDiffTracker';
  import { openDiffFile } from '../postMessage';

  export let entry: ChangeEntryPayload;

  let expanded = false;

  /** Determine icon based on operation type */
  function getIcon(op: string): string {
    if (op === 'added') return '+';
    if (op === 'deleted') return '−';
    return '~';
  }

  /** Determine CSS class for operation badge */
  function getOpClass(op: string): string {
    return `op-${op}`;
  }

  /** Open the file in VS Code diff editor */
  function handleFileClick(): void {
    openDiffFile(entry.filePath, entry.operation);
  }

  /** Toggle diff content visibility */
  function toggleExpand(): void {
    expanded = !expanded;
  }

  /** Check if diff content is large (>500 lines collapsed by default) */
  $: isLargeDiff = entry.diffContent.split('\n').length > 500;
</script>

<div class="entry-row">
  <div class="entry-header">
    <button class="expand-btn" on:click={toggleExpand} aria-expanded={expanded}>
      {expanded ? '▾' : '▸'}
    </button>
    <span class="op-badge {getOpClass(entry.operation)}">{getIcon(entry.operation)}</span>
    <button class="file-path" on:click={handleFileClick} title="Open in diff editor">
      {entry.filePath}
    </button>
    <span class="line-stats">
      {#if entry.linesAdded > 0}<span class="added">+{entry.linesAdded}</span>{/if}
      {#if entry.linesRemoved > 0}<span class="removed">-{entry.linesRemoved}</span>{/if}
    </span>
  </div>

  {#if expanded}
    <div class="diff-content" class:large-diff={isLargeDiff}>
      <pre><code>{entry.diffContent}</code></pre>
    </div>
  {/if}
</div>

<style>
  .entry-row {
    border-bottom: 1px solid var(--vscode-panel-border, #333);
  }
  .entry-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
  }
  .expand-btn {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    width: 16px;
  }
  .op-badge {
    font-size: 12px;
    font-weight: 700;
    width: 16px;
    text-align: center;
  }
  .op-added { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
  .op-modified { color: var(--vscode-terminal-ansiYellow, #dcdcaa); }
  .op-deleted { color: var(--vscode-terminal-ansiRed, #f44747); }
  .file-path {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    cursor: pointer;
    font-size: 12px;
    text-decoration: none;
    text-align: left;
    padding: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-path:hover { text-decoration: underline; }
  .line-stats {
    font-size: 11px;
    display: flex;
    gap: 4px;
  }
  .added { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
  .removed { color: var(--vscode-terminal-ansiRed, #f44747); }
  .diff-content {
    padding: 4px 8px 8px 32px;
    max-height: 300px;
    overflow: auto;
  }
  .diff-content.large-diff { max-height: 200px; }
  .diff-content pre {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--vscode-editor-foreground);
  }
</style>
