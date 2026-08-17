<!--
  SA4E-106 — EnrichmentProgress component.
  Polls /api/admin/taskworker/progress to display LLM enrichment progress.
  Shows progress bar with completed/total (percentage).
  Auto-hides when no enrichment tasks exist.
  WCAG 2.1 AA compliant with proper ARIA attributes.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  /** Enrichment progress state from backend API. */
  interface ProgressState {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    percentage: number;
    isProcessing: boolean;
  }

  const POLL_INTERVAL_MS = 5000;
  const API_PATH = '/api/admin/taskworker/progress';

  let state: ProgressState = {
    total: 0, completed: 0, pending: 0,
    failed: 0, percentage: 0, isProcessing: false,
  };
  let pollTimerId: ReturnType<typeof setInterval> | null = null;
  let visible = false;

  /** Fetch progress from backend and update state. */
  async function fetchProgress(): Promise<void> {
    try {
      const res = await fetch(API_PATH);
      if (!res.ok) return;
      const data = await res.json();
      updateState(data);
    } catch {
      // Non-fatal: silently skip poll failures
    }
  }

  /** Map API response to component state. */
  function updateState(data: any): void {
    if (!data || data.total === undefined) {
      visible = false;
      return;
    }
    state = {
      total: data.total ?? 0,
      completed: data.completed ?? data.current ?? 0,
      pending: data.pending ?? 0,
      failed: data.failed ?? 0,
      percentage: data.percent ?? 0,
      isProcessing: (data.pending ?? 0) > 0 || (data.processing ?? 0) > 0,
    };
    visible = state.total > 0;
  }

  onMount(() => {
    fetchProgress();
    pollTimerId = setInterval(fetchProgress, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    if (pollTimerId) clearInterval(pollTimerId);
  });
</script>

{#if visible}
  <div
    class="enrichment-progress"
    role="status"
    aria-live="polite"
    aria-label="Enrichment progress: {state.completed} of {state.total}"
  >
    <div class="progress-header">
      <span class="progress-label">
        Enriching symbols: {state.completed}/{state.total} ({state.percentage}%)
      </span>
      {#if state.failed > 0}
        <span class="failed-count" aria-label="{state.failed} failed">
          ⚠ {state.failed} failed
        </span>
      {/if}
    </div>
    <div class="progress-bar-track" aria-hidden="true">
      <div
        class="progress-bar-fill"
        style="width: {state.percentage}%"
      ></div>
    </div>
  </div>
{/if}

<style>
  .enrichment-progress {
    padding: 6px 12px;
    background: var(--vscode-editor-background, #1e1e1e);
    border-bottom: 1px solid var(--vscode-panel-border, #2d2d2d);
    flex-shrink: 0;
  }
  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .progress-label {
    font-size: 11px;
    color: var(--vscode-foreground, #ccc);
  }
  .failed-count {
    font-size: 11px;
    color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .progress-bar-track {
    height: 4px;
    border-radius: 2px;
    background: var(--vscode-progressBar-background, #333);
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--vscode-progressBar-background, #0e70c0);
    transition: width 0.3s ease;
  }
</style>
