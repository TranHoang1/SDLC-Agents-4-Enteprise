<!--
  SA4E-183 — ChangeBadge component.
  Displays file change count badge in the ChatHeader.
  Clicking requests the diff summary panel to expand.
-->
<script lang="ts">
  import { diffFileCount } from '../stores/diffTrackerStore';
  import { dispatchCommand } from '../postMessage';

  /** Request diff summary from extension host when badge is clicked */
  function handleClick(): void {
    dispatchCommand('diff');
  }
</script>

{#if $diffFileCount > 0}
  <button
    class="change-badge"
    on:click={handleClick}
    aria-label="{$diffFileCount} file{$diffFileCount > 1 ? 's' : ''} changed"
    title="View file changes ({$diffFileCount})"
  >
    <span class="badge-icon">&#x1F4C4;</span>
    <span class="badge-count">{$diffFileCount}</span>
  </button>
{/if}

<style>
  .change-badge {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border: none;
    border-radius: 10px;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    font-size: 11px;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }
  .change-badge:hover {
    opacity: 0.85;
  }
  .badge-icon {
    font-size: 12px;
    line-height: 1;
  }
  .badge-count {
    font-weight: 600;
    min-width: 14px;
    text-align: center;
  }
</style>
