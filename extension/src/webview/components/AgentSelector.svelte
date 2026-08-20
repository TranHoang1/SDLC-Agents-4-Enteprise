<!--
  SA4E-85 - AgentSelector (Task 3.3).
  Dropdown showing available agents with name + description.
  Reactive to agentStore changes. Selecting dispatches COMMAND_DISPATCH.
  WCAG 2.1 AA: full keyboard nav, ARIA listbox pattern.
-->
<script lang="ts">
  import { agents, selectedAgentId, selectAgent as storeSelectAgent } from '../stores/agentStore';

  let isOpen = false;
  let buttonRef: HTMLButtonElement;

  /** Currently selected agent name for display */
  $: currentAgent = $agents.find((a) => a.id === $selectedAgentId);
  $: displayName = currentAgent?.name ?? 'Select Agent';

  /** Toggle dropdown visibility */
  function toggle(): void {
    isOpen = !isOpen;
  }

  /** Close dropdown */
  function close(): void {
    isOpen = false;
  }

  /** Select agent via store (SA4E-186: triggers runtime routing) */
  function selectAgent(agentId: string): void {
    storeSelectAgent(agentId);
    close();
    buttonRef?.focus();
  }

  /** Handle keyboard navigation within the dropdown */
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      close();
      buttonRef?.focus();
    }
  }

  /** Handle keyboard on individual option */
  function handleOptionKey(event: KeyboardEvent, agentId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectAgent(agentId);
    }
  }
</script>

<div class="agent-selector" on:keydown={handleKeydown}>
  <button
    bind:this={buttonRef}
    class="selector-trigger"
    on:click={toggle}
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    aria-label="Select agent: {displayName}"
  >
    <span class="agent-name">{displayName}</span>
    <svg class="chevron" class:open={isOpen} width="12" height="12"
         viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M2 4L6 8L10 4"/>
    </svg>
  </button>

  {#if isOpen}
    <ul class="dropdown-list" role="listbox" aria-label="Available agents">
      {#each $agents as agent (agent.id)}
        <li
          class="dropdown-item"
          class:selected={agent.id === $selectedAgentId}
          role="option"
          aria-selected={agent.id === $selectedAgentId}
          tabindex="0"
          on:click={() => selectAgent(agent.id)}
          on:keydown={(e) => handleOptionKey(e, agent.id)}
        >
          <span class="item-name">{agent.name}</span>
          {#if agent.description}
            <span class="item-desc">{agent.description}</span>
          {/if}
        </li>
      {/each}
      {#if $agents.length === 0}
        <li class="dropdown-empty" role="option" aria-disabled="true">
          No agents available
        </li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .agent-selector {
    position: relative;
    display: inline-block;
  }
  .selector-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
    border-radius: 4px;
    background: var(--vscode-dropdown-background, #1e1e1e);
    color: var(--vscode-dropdown-foreground, #ccc);
    font-size: 12px;
    cursor: pointer;
    min-width: 120px;
  }
  .selector-trigger:hover {
    border-color: var(--vscode-focusBorder, #007acc);
  }
  .selector-trigger:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007acc);
    outline-offset: 1px;
  }
  .agent-name {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chevron {
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .chevron.open {
    transform: rotate(180deg);
  }
  .dropdown-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: 4px 0 0;
    padding: 4px 0;
    list-style: none;
    background: var(--vscode-dropdown-background, #252526);
    border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
  }
  .dropdown-item {
    display: flex;
    flex-direction: column;
    padding: 6px 10px;
    cursor: pointer;
    gap: 2px;
  }
  .dropdown-item:hover,
  .dropdown-item:focus-visible {
    background: var(--vscode-list-hoverBackground, #2a2d2e);
    outline: none;
  }
  .dropdown-item.selected {
    background: var(--vscode-list-activeSelectionBackground, #094771);
    color: var(--vscode-list-activeSelectionForeground, #fff);
  }
  .item-name {
    font-size: 12px;
    font-weight: 500;
  }
  .item-desc {
    font-size: 11px;
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dropdown-empty {
    padding: 8px 10px;
    font-size: 11px;
    opacity: 0.5;
    font-style: italic;
  }
</style>
