<!--
  SA4E-85 — PermissionGuard (Task 4.5).
  Modal overlay for tool approval. Shows tool name, args, risk level.
  60s countdown auto-deny. Focus trap for WCAG compliance.
  Buttons: Allow (green), Deny (red), Allow All Session (link).
-->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { ToolType } from '../../chat/types';

  /** Unique tool call identifier */
  export let toolId: string;
  /** Tool display name */
  export let name: string;
  /** Tool arguments for display */
  export let args: Record<string, unknown> = {};
  /** Tool type for risk classification */
  export let toolType: ToolType;

  const dispatch = createEventDispatcher<{
    approve: { toolId: string };
    deny: { toolId: string };
    approveSession: { toolId: string; toolType: ToolType };
  }>();

  const TIMEOUT_SECONDS = 60;
  let remainingSeconds = TIMEOUT_SECONDS;
  let countdownId: ReturnType<typeof setInterval> | null = null;
  let guardElement: HTMLElement;

  $: riskLevel = classifyRisk(toolType);
  $: riskIcon = getRiskIcon(riskLevel);
  $: riskLabel = getRiskLabel(riskLevel);
  $: argsSummary = formatArgs(args);

  onMount(() => {
    startCountdown();
    trapFocus();
  });

  onDestroy(() => {
    stopCountdown();
  });

  function startCountdown(): void {
    countdownId = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        stopCountdown();
        handleDeny();
      }
    }, 1000);
  }

  function stopCountdown(): void {
    if (countdownId !== null) {
      clearInterval(countdownId);
      countdownId = null;
    }
  }

  function handleApprove(): void {
    stopCountdown();
    dispatch('approve', { toolId });
  }

  function handleDeny(): void {
    stopCountdown();
    dispatch('deny', { toolId });
  }

  function handleApproveSession(): void {
    stopCountdown();
    dispatch('approveSession', { toolId, toolType });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      handleDeny();
    }
  }

  /** WCAG focus trap — Tab cycles within guard element */
  function trapFocus(): void {
    if (!guardElement) return;
    const focusable = guardElement.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
  }

  function handleFocusTrap(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = guardElement?.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function classifyRisk(type: ToolType): 'high' | 'medium' | 'low' {
    if (type === 'shell') return 'high';
    if (type === 'file') return 'medium';
    return 'low';
  }

  function getRiskIcon(level: 'high' | 'medium' | 'low'): string {
    if (level === 'high') return '🔴';
    if (level === 'medium') return '🟡';
    return '🟢';
  }

  function getRiskLabel(level: 'high' | 'medium' | 'low'): string {
    if (level === 'high') return 'High Risk';
    if (level === 'medium') return 'Medium Risk';
    return 'Low Risk';
  }

  function formatArgs(a: Record<string, unknown>): string {
    const entries = Object.entries(a).slice(0, 4);
    return entries.map(([k, v]) => `${k}: ${truncate(String(v), 60)}`).join('\n');
  }

  function truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }
</script>

<div
  class="permission-guard-overlay"
  role="alertdialog"
  aria-modal="true"
  aria-label="Tool permission request for {name}"
  bind:this={guardElement}
  on:keydown={handleKeydown}
  on:keydown={handleFocusTrap}
>
  <div class="permission-guard">
    <!-- Header with risk level -->
    <div class="guard-header">
      <span class="risk-icon" aria-hidden="true">{riskIcon}</span>
      <span class="guard-title">Tool Requires Approval</span>
      <span class="risk-badge" class:high={riskLevel === 'high'} class:medium={riskLevel === 'medium'}>
        {riskLabel}
      </span>
    </div>

    <!-- Tool info -->
    <div class="guard-body">
      <div class="tool-info">
        <span class="tool-name-label">Tool:</span>
        <code class="tool-name-value">{name}</code>
      </div>
      {#if argsSummary}
        <pre class="args-summary">{argsSummary}</pre>
      {/if}
    </div>

    <!-- Countdown -->
    <div class="countdown" aria-live="polite" aria-atomic="true">
      Auto-deny in <strong>{remainingSeconds}s</strong>
    </div>

    <!-- Actions -->
    <div class="guard-actions">
      <button class="btn btn-allow" on:click={handleApprove}>
        Allow
      </button>
      <button class="btn btn-deny" on:click={handleDeny}>
        Deny
      </button>
    </div>

    <button class="session-link" on:click={handleApproveSession}>
      Allow all {toolType} tools this session
    </button>
  </div>
</div>

<style>
  .permission-guard-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
    padding: 16px;
  }
  .permission-guard {
    width: 100%;
    max-width: 380px;
    background: var(--vscode-editor-background, #1e1e1e);
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 6px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .guard-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .guard-title {
    font-weight: 600;
    font-size: 13px;
    color: var(--vscode-foreground, #ccc);
  }
  .risk-badge {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
  }
  .risk-badge.high {
    background: #5c2020;
    color: #f14c4c;
  }
  .risk-badge.medium {
    background: #4d3800;
    color: #cca700;
  }
  .guard-body {
    margin-bottom: 12px;
  }
  .tool-info {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8px;
  }
  .tool-name-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
  }
  .tool-name-value {
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground, #ccc);
  }
  .args-summary {
    margin: 0;
    padding: 6px 8px;
    background: var(--vscode-textBlockQuote-background, #2a2a2a);
    border-radius: 3px;
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-descriptionForeground, #888);
    line-height: 1.4;
    white-space: pre-wrap;
    max-height: 80px;
    overflow-y: auto;
  }
  .countdown {
    text-align: center;
    font-size: 11px;
    color: var(--vscode-editorWarning-foreground, #cca700);
    margin-bottom: 12px;
  }
  .guard-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .btn {
    flex: 1;
    padding: 6px 12px;
    border: none;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn:focus-visible {
    outline: 2px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }
  .btn-allow {
    background: var(--vscode-testing-iconPassed, #388a34);
    color: #fff;
  }
  .btn-allow:hover {
    opacity: 0.9;
  }
  .btn-deny {
    background: var(--vscode-testing-iconFailed, #f14c4c);
    color: #fff;
  }
  .btn-deny:hover {
    opacity: 0.9;
  }
  .session-link {
    display: block;
    width: 100%;
    padding: 4px;
    border: none;
    background: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-size: 11px;
    cursor: pointer;
    text-align: center;
    text-decoration: underline;
  }
  .session-link:hover {
    color: var(--vscode-textLink-activeForeground, #3794ff);
  }
  .session-link:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }
</style>
