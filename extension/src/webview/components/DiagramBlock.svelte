<!--
  SA4E-85 — DiagramBlock (Task 8.2).
  Inline SVG diagram display in chat messages.
  Renders sanitized SVG when available, falls back to source code block.
  Supports: plantuml (rendered), bpmn/cmmn (source-only fallback).
-->
<script lang="ts">
  import DOMPurify from 'dompurify';

  /** Unique diagram identifier */
  export let diagramId: string;
  /** Diagram type: plantuml, bpmn, cmmn */
  export let type: 'plantuml' | 'bpmn' | 'cmmn' | 'drawio-xml' = 'plantuml';
  /** Raw diagram source code */
  export let source: string;
  /** Pre-rendered SVG string (already rendered by DiagramRenderer) */
  export let renderedSvg: string | undefined = undefined;
  /** Agent that produced this diagram */
  export let agentId: string = '';

  /** Whether to show source code (toggle) */
  let showSource = false;

  /** Sanitize SVG to prevent XSS via DOMPurify */
  $: sanitizedSvg = renderedSvg
    ? DOMPurify.sanitize(renderedSvg, { USE_PROFILES: { svg: true } })
    : '';

  $: hasRenderedSvg = Boolean(sanitizedSvg);
  $: diagramLabel = getLabelForType(type);

  function toggleSource(): void {
    showSource = !showSource;
  }

  function getLabelForType(t: string): string {
    if (t === 'plantuml') return 'PlantUML';
    if (t === 'bpmn') return 'BPMN';
    if (t === 'cmmn') return 'CMMN';
    return 'Diagram';
  }
</script>

<div
  class="diagram-block"
  role="figure"
  aria-label="{diagramLabel} diagram from {agentId}"
  data-diagram-id={diagramId}
>
  <!-- Header bar with type badge and toggle -->
  <div class="diagram-header">
    <span class="diagram-badge">{diagramLabel}</span>
    {#if hasRenderedSvg}
      <button
        class="toggle-source-btn"
        on:click={toggleSource}
        aria-expanded={showSource}
        aria-controls="diagram-source-{diagramId}"
      >
        {showSource ? 'Hide Source' : 'View Source'}
      </button>
    {/if}
  </div>

  <!-- Rendered SVG display -->
  {#if hasRenderedSvg && !showSource}
    <div class="diagram-svg-container" aria-label="Rendered diagram">
      {@html sanitizedSvg}
    </div>
  {:else}
    <!-- Fallback: show raw source in code block -->
    <pre
      class="diagram-source"
      id="diagram-source-{diagramId}"
      aria-label="Diagram source code"
    ><code>{source}</code></pre>
  {/if}
</div>

<style>
  .diagram-block {
    margin: 8px 0;
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 4px;
    overflow: hidden;
  }
  .diagram-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: var(--vscode-editor-lineHighlightBackground, #2a2a2a);
    border-bottom: 1px solid var(--vscode-panel-border, #444);
  }
  .diagram-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-badge-foreground, #fff);
    background: var(--vscode-badge-background, #4d4d4d);
    padding: 2px 6px;
    border-radius: 3px;
  }
  .toggle-source-btn {
    border: none;
    background: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-size: 11px;
    cursor: pointer;
    padding: 2px 4px;
  }
  .toggle-source-btn:hover {
    text-decoration: underline;
  }
  .toggle-source-btn:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }
  .diagram-svg-container {
    padding: 8px;
    overflow-x: auto;
    background: var(--vscode-editor-background, #1e1e1e);
    text-align: center;
  }
  .diagram-svg-container :global(svg) {
    max-width: 100%;
    height: auto;
  }
  .diagram-source {
    margin: 0;
    padding: 8px;
    background: var(--vscode-textBlockQuote-background, #2a2a2a);
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, monospace);
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--vscode-editor-foreground, #ccc);
  }
</style>
