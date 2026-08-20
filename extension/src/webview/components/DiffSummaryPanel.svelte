<!--
  SA4E-183 — DiffSummaryPanel component.
  Expandable panel showing grouped file changes with summary stats.
  Displayed inline in the chat when /diff command is invoked.
-->
<script lang="ts">
  import { diffSummary, isDiffExpanded, toggleDiffPanel } from '../stores/diffTrackerStore';
  import DiffEntryRow from './DiffEntryRow.svelte';

  /** Group entries by operation type for organized display */
  $: addedEntries = ($diffSummary?.entries ?? []).filter(e => e.operation === 'added');
  $: modifiedEntries = ($diffSummary?.entries ?? []).filter(e => e.operation === 'modified');
  $: deletedEntries = ($diffSummary?.entries ?? []).filter(e => e.operation === 'deleted');
</script>

{#if $diffSummary && $isDiffExpanded}
  <div class="diff-panel" role="region" aria-label="File changes summary">
    <div class="panel-header">
      <button class="collapse-btn" on:click={toggleDiffPanel} aria-label="Collapse changes panel">
        ▾ File Changes
      </button>
      <div class="summary-stats">
        <span class="stat total">{$diffSummary.totalFiles} file{$diffSummary.totalFiles !== 1 ? 's' : ''}</span>
        {#if $diffSummary.totalAdded > 0}
          <span class="stat added">+{$diffSummary.totalAdded} added</span>
        {/if}
        {#if $diffSummary.totalModified > 0}
          <span class="stat modified">~{$diffSummary.totalModified} modified</span>
        {/if}
        {#if $diffSummary.totalDeleted > 0}
          <span class="stat deleted">-{$diffSummary.totalDeleted} deleted</span>
        {/if}
      </div>
      <div class="line-totals">
        <span class="added">+{$diffSummary.totalLinesAdded}</span>
        <span class="removed">-{$diffSummary.totalLinesRemoved}</span>
      </div>
    </div>

    <div class="panel-body">
      {#if addedEntries.length > 0}
        <div class="group">
          <h4 class="group-title added-title">Added ({addedEntries.length})</h4>
          {#each addedEntries as entry (entry.filePath)}
            <DiffEntryRow {entry} />
          {/each}
        </div>
      {/if}

      {#if modifiedEntries.length > 0}
        <div class="group">
          <h4 class="group-title modified-title">Modified ({modifiedEntries.length})</h4>
          {#each modifiedEntries as entry (entry.filePath)}
            <DiffEntryRow {entry} />
          {/each}
        </div>
      {/if}

      {#if deletedEntries.length > 0}
        <div class="group">
          <h4 class="group-title deleted-title">Deleted ({deletedEntries.length})</h4>
          {#each deletedEntries as entry (entry.filePath)}
            <DiffEntryRow {entry} />
          {/each}
        </div>
      {/if}

      {#if $diffSummary.totalFiles === 0}
        <p class="empty-state">No file changes in this session.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .diff-panel {
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 4px;
    margin: 8px 0;
    background: var(--vscode-editor-background);
    max-height: 400px;
    display: flex;
    flex-direction: column;
  }
  .panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    flex-shrink: 0;
  }
  .collapse-btn {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
  .summary-stats {
    display: flex;
    gap: 8px;
    font-size: 11px;
  }
  .stat { opacity: 0.8; }
  .stat.added { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
  .stat.modified { color: var(--vscode-terminal-ansiYellow, #dcdcaa); }
  .stat.deleted { color: var(--vscode-terminal-ansiRed, #f44747); }
  .line-totals {
    margin-left: auto;
    font-size: 11px;
    display: flex;
    gap: 6px;
  }
  .line-totals .added { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
  .line-totals .removed { color: var(--vscode-terminal-ansiRed, #f44747); }
  .panel-body {
    overflow-y: auto;
    flex: 1;
  }
  .group { margin: 0; }
  .group-title {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    margin: 0;
    background: var(--vscode-sideBar-background, #1e1e1e);
  }
  .added-title { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
  .modified-title { color: var(--vscode-terminal-ansiYellow, #dcdcaa); }
  .deleted-title { color: var(--vscode-terminal-ansiRed, #f44747); }
  .empty-state {
    padding: 12px;
    text-align: center;
    font-size: 12px;
    opacity: 0.6;
  }
</style>
