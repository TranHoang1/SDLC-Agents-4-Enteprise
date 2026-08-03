<!--
  SA4E-85 — ContextBadge (Tasks 6.1, 6.2, 6.4, 6.5).
  Token usage progress bar with expand/collapse file list.
  BR-08: Pulse animation at >80% usage.
  BR-09: Auto-suggest prune at >90% usage.
  Color: green (>50% free) → yellow (20-50% free) → red (<20% free).
-->
<script lang="ts">
  import { usagePercent, contextFiles, pruneSuggestions, tokenCount } from '../stores/contextStore';
  import { contextState } from '../stores/contextStore';
  import { getBarColor, formatTokens, extractFileName } from './contextBadgeUtils';

  let expanded = false;

  function toggleExpanded(): void { expanded = !expanded; }

  /** Unpin a file via postMessage to Extension Host */
  function handleUnpin(filePath: string): void {
    const vscodeApi = acquireVsCodeApi();
    vscodeApi.postMessage({ type: 'CONTEXT_UNPIN_FILE', filePath });
  }

  declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

  $: barColor = getBarColor($usagePercent);
  $: shouldPulse = $usagePercent > 80;
  $: shouldSuggest = $usagePercent > 90;
  $: currentTokens = $tokenCount;
  $: maxTokens = $contextState.maxTokens;
  $: files = $contextFiles;
  $: suggestions = $pruneSuggestions;
</script>

<div
  class="context-badge"
  class:pulse={shouldPulse}
  role="button"
  tabindex="0"
  aria-label="Token usage: {$usagePercent}%. Click to {expanded ? 'collapse' : 'expand'} file list."
  aria-expanded={expanded}
  on:click={toggleExpanded}
  on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpanded(); }}
>
  <div class="badge-content">
    <span class="token-text">{formatTokens(currentTokens)}/{formatTokens(maxTokens)}</span>
    <div class="progress-track" role="progressbar" aria-valuenow={$usagePercent} aria-valuemin={0} aria-valuemax={100}>
      <div class="progress-fill" style="width: {$usagePercent}%; background: {barColor};"></div>
    </div>
  </div>
</div>

{#if expanded}
  <div class="context-panel" role="region" aria-label="Context files">
    {#if files.length === 0}
      <p class="empty-text">No files in context</p>
    {:else}
      <ul class="file-list">
        {#each files as file (file.path)}
          <li class="file-item">
            <span class="file-name" title={file.path}>{extractFileName(file.path)}</span>
            <span class="file-tokens">{formatTokens(file.tokenCount)}</span>
            <button
              class="unpin-btn"
              aria-label="Unpin {extractFileName(file.path)}"
              on:click|stopPropagation={() => handleUnpin(file.path)}
            >✕</button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if shouldSuggest && suggestions.length > 0}
      <div class="prune-suggestions" aria-label="Prune suggestions">
        <p class="suggest-title">Suggested to unpin:</p>
        <ul class="suggest-list">
          {#each suggestions as suggestion (suggestion.filePath)}
            <li class="suggest-item">
              <span class="suggest-name">{extractFileName(suggestion.filePath)}</span>
              <span class="suggest-save">−{formatTokens(suggestion.tokensSaved)}</span>
              <button
                class="unpin-btn"
                aria-label="Unpin suggested: {extractFileName(suggestion.filePath)}"
                on:click|stopPropagation={() => handleUnpin(suggestion.filePath)}
              >✕</button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}

<style>
  .context-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    background: var(--vscode-badge-background, #4d4d4d);
    transition: opacity 0.2s ease;
    user-select: none;
  }
  .context-badge:hover { opacity: 0.85; }
  .context-badge:focus-visible {
    outline: 2px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }
  /* BR-08: Pulse animation at >80% (Task 6.5) */
  .context-badge.pulse { animation: badge-pulse 1.5s ease-in-out infinite; }
  @keyframes badge-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .badge-content { display: flex; align-items: center; gap: 6px; }
  .token-text {
    font-size: 11px;
    color: var(--vscode-badge-foreground, #fff);
    white-space: nowrap;
  }
  .progress-track {
    width: 48px; height: 4px;
    background: var(--vscode-input-background, #333);
    border-radius: 2px; overflow: hidden;
  }
  .progress-fill {
    height: 100%; border-radius: 2px;
    transition: width 0.3s ease, background 0.3s ease;
  }
  .context-panel {
    position: absolute; top: 100%; right: 0;
    width: 260px; max-height: 200px; overflow-y: auto;
    background: var(--vscode-dropdown-background, #252526);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px; padding: 6px; margin-top: 4px;
    z-index: 100; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .empty-text {
    font-size: 11px; color: var(--vscode-descriptionForeground);
    margin: 4px 0; text-align: center;
  }
  .file-list, .suggest-list { list-style: none; margin: 0; padding: 0; }
  .file-item, .suggest-item {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 4px; border-radius: 3px; font-size: 11px;
  }
  .file-item:hover, .suggest-item:hover { background: var(--vscode-list-hoverBackground); }
  .file-name, .suggest-name {
    flex: 1; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; color: var(--vscode-foreground);
  }
  .file-tokens, .suggest-save {
    font-size: 10px; color: var(--vscode-descriptionForeground); flex-shrink: 0;
  }
  .suggest-save { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
  .unpin-btn {
    background: none; border: none;
    color: var(--vscode-errorForeground, #f44);
    cursor: pointer; padding: 0 2px; font-size: 12px;
    line-height: 1; border-radius: 2px; flex-shrink: 0;
  }
  .unpin-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
  .unpin-btn:focus-visible { outline: 1px solid var(--vscode-focusBorder); }
  .prune-suggestions {
    border-top: 1px solid var(--vscode-panel-border);
    margin-top: 4px; padding-top: 4px;
  }
  .suggest-title {
    font-size: 10px; color: var(--vscode-editorWarning-foreground, #cca700);
    margin: 0 0 4px 0; font-weight: 600;
  }
</style>
