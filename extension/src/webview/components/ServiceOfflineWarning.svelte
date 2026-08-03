<!--
  SA4E-85 — ServiceOfflineWarning (Task 7.5).
  Non-intrusive warning bar shown when IPC service is offline (all retries exhausted).
  Displays service name + "Auto-start" button (Task 7.6).
  Auto-hides when service reconnects (IPC_STATUS changes to 'connected').
  WCAG 2.1 AA compliant with proper ARIA attributes.
-->
<script lang="ts">
  import { servicesList } from '../stores/connectionStore';
  import { runTerminalCommand } from '../postMessage';
  import type { ServiceConnection } from '../stores/connectionStore';

  /** Filter to only offline services that need user attention */
  $: offlineServices = $servicesList.filter(
    (svc: ServiceConnection) => svc.status === 'offline'
  );

  /** Whether any service is offline */
  $: hasOffline = offlineServices.length > 0;

  /**
   * Task 7.6: Auto-start terminal command.
   * Spawns a VSCode terminal with the service start command.
   */
  function handleAutoStart(serviceName: string): void {
    const command = `code-intel start ${serviceName}`;
    const terminalName = `Start ${serviceName}`;
    runTerminalCommand(command, terminalName);
  }
</script>

{#if hasOffline}
  <div
    class="offline-warning"
    role="alert"
    aria-live="polite"
    aria-atomic="true"
  >
    {#each offlineServices as svc (svc.service)}
      <div class="warning-item">
        <span class="warning-icon" aria-hidden="true">⚠</span>
        <span class="warning-text">
          <strong>{svc.service}</strong> is offline
        </span>
        <button
          class="auto-start-btn"
          on:click={() => handleAutoStart(svc.service)}
          aria-label="Auto-start {svc.service} service"
          title="Start {svc.service} in terminal"
        >
          Auto-start
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .offline-warning {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 12px;
    background: var(--vscode-inputValidation-warningBackground, #352a05);
    border-bottom: 1px solid var(--vscode-inputValidation-warningBorder, #9d8012);
    flex-shrink: 0;
  }
  .warning-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--vscode-foreground);
  }
  .warning-icon {
    font-size: 14px;
    color: var(--vscode-editorWarning-foreground, #cca700);
    flex-shrink: 0;
  }
  .warning-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auto-start-btn {
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #fff);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .auto-start-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, #45494e);
  }
  .auto-start-btn:focus-visible {
    outline: 2px solid var(--vscode-focusBorder, #007acc);
    outline-offset: 1px;
  }
</style>
