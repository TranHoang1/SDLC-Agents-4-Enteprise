<!--
  SA4E-85 — ToolSpinner (Task 4.1).
  Inline indicator showing tool name + spinner while running.
  Displays ✓ on success, ✗ on failure. Shows elapsed time after 10s.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  /** Tool display name */
  export let name: string;
  /** Current execution status */
  export let status: 'pending' | 'running' | 'completed' | 'failed' = 'running';
  /** Human-readable description of what the tool does */
  export let description: string = '';

  let elapsedSeconds = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let startTime: number;

  onMount(() => {
    startTime = Date.now();
    intervalId = setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    }, 1000);
  });

  onDestroy(() => {
    if (intervalId !== null) clearInterval(intervalId);
  });

  // Stop timer when tool completes
  $: if (status === 'completed' || status === 'failed') {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  $: showElapsed = status === 'running' && elapsedSeconds >= 10;
  $: statusIcon = getStatusIcon(status);
  $: ariaLabel = buildAriaLabel(name, status, elapsedSeconds);

  function getStatusIcon(s: typeof status): string {
    if (s === 'completed') return '✓';
    if (s === 'failed') return '✗';
    return '';
  }

  function buildAriaLabel(n: string, s: typeof status, elapsed: number): string {
    if (s === 'completed') return `${n} completed successfully`;
    if (s === 'failed') return `${n} failed`;
    if (elapsed >= 10) return `${n} running for ${elapsed} seconds`;
    return `${n} running`;
  }
</script>

<div
  class="tool-spinner"
  class:completed={status === 'completed'}
  class:failed={status === 'failed'}
  role="status"
  aria-label={ariaLabel}
  aria-live="polite"
>
  {#if status === 'running' || status === 'pending'}
    <span class="spinner" aria-hidden="true"></span>
  {:else}
    <span class="status-icon" class:success={status === 'completed'} class:error={status === 'failed'}>
      {statusIcon}
    </span>
  {/if}

  <span class="tool-name">{name}</span>

  {#if description}
    <span class="tool-desc">— {description}</span>
  {/if}

  {#if showElapsed}
    <span class="elapsed">Running for {elapsedSeconds}s...</span>
  {/if}
</div>

<style>
  .tool-spinner {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground, #888);
    line-height: 1.4;
  }
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--vscode-progressBar-background, #0078d4);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .status-icon {
    font-size: 14px;
    font-weight: bold;
  }
  .status-icon.success {
    color: var(--vscode-testing-iconPassed, #388a34);
  }
  .status-icon.error {
    color: var(--vscode-testing-iconFailed, #f14c4c);
  }
  .tool-name {
    font-weight: 600;
    color: var(--vscode-foreground, #ccc);
  }
  .tool-desc {
    color: var(--vscode-descriptionForeground, #888);
  }
  .elapsed {
    margin-left: 4px;
    font-style: italic;
    color: var(--vscode-editorWarning-foreground, #cca700);
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
