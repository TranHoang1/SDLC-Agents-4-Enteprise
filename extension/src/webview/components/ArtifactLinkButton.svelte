<!--
  SA4E-85 — ArtifactLinkButton (Task 4.4).
  Renders a clickable button for detected artifact paths.
  Click opens file in editor or browser depending on type.
-->
<script lang="ts">
  import type { ArtifactType } from '../../chat/tools';

  /** Button display label (e.g. "View Test Report") */
  export let label: string;
  /** File path to the artifact */
  export let path: string;
  /** Artifact category for icon selection */
  export let type: ArtifactType = 'generic';

  $: icon = getIcon(type);

  function getIcon(t: ArtifactType): string {
    switch (t) {
      case 'test-report': return '📊';
      case 'coverage': return '📈';
      case 'build': return '📦';
      default: return '📄';
    }
  }

  /** Post message to extension host to open artifact */
  function handleClick(): void {
    // @ts-ignore — vscode API available in webview context
    const vscode = acquireVsCodeApi?.() ?? window.vscodeApi;
    if (vscode) {
      vscode.postMessage({
        type: 'COMMAND_DISPATCH',
        command: 'sa4e.openArtifact',
        args: { path, type },
      });
    }
  }
</script>

<button
  class="artifact-btn"
  on:click={handleClick}
  title="Open: {path}"
  aria-label="{label} at {path}"
>
  <span class="artifact-icon" aria-hidden="true">{icon}</span>
  <span class="artifact-label">{label}</span>
</button>

<style>
  .artifact-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--vscode-button-secondaryBorder, #444);
    border-radius: 3px;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
    font-size: 11px;
    cursor: pointer;
    transition: background 100ms ease;
  }
  .artifact-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, #454849);
  }
  .artifact-btn:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }
  .artifact-icon {
    font-size: 12px;
  }
  .artifact-label {
    white-space: nowrap;
  }
</style>
