<!--
  SA4E-85 — Deep-link "Open in AntiGravity" Button (Task 7.7).
  Rendered when MCP_TOOL_RESULT contains deepLinkUri field.
  Click dispatches COMMAND_DISPATCH to Extension Host which calls
  vscode.env.openExternal(Uri.parse(deepLinkUri)).
  WCAG 2.1 AA: proper focus, contrast, label.
-->
<script lang="ts">
  import { dispatchCommand } from '../postMessage';

  /** The deep-link URI to open (antigravity:// scheme) */
  export let deepLinkUri: string;

  /** Optional label override */
  export let label: string = 'Open in AntiGravity';

  /** Dispatch openExternal command to Extension Host */
  function handleClick(): void {
    dispatchCommand('kiroSdlc.openExternal', { uri: deepLinkUri });
  }
</script>

<button
  class="deep-link-btn"
  on:click={handleClick}
  aria-label={label}
  title="Open in AntiGravity: {deepLinkUri}"
>
  <span class="btn-icon" aria-hidden="true">↗</span>
  <span class="btn-label">{label}</span>
</button>

<style>
  .deep-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    margin-top: 4px;
    font-size: 11px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
    cursor: pointer;
    white-space: nowrap;
  }
  .deep-link-btn:hover {
    background: var(--vscode-button-hoverBackground, #1177bb);
  }
  .deep-link-btn:focus-visible {
    outline: 2px solid var(--vscode-focusBorder, #007acc);
    outline-offset: 1px;
  }
  .btn-icon {
    font-size: 12px;
  }
  .btn-label {
    font-weight: 500;
  }
</style>
