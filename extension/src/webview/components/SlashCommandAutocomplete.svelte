<!--
  SA4E-85 - SlashCommandAutocomplete (Task 3.4).
  Popup menu when user types "/" at start of input.
  Lists /ask-{agentId} for each registered agent + built-in commands.
  Arrow keys navigate, Enter selects, Escape closes.
  WCAG 2.1 AA: ARIA listbox, keyboard nav, focus management.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { agents } from '../stores/agentStore';

  export let visible = false;
  export let filter = '';

  const dispatch = createEventDispatcher<{
    select: { command: string };
    close: void;
  }>();

  /** Built-in commands always available */
  const BUILTIN_COMMANDS = [
    { command: '/clear', description: 'Clear chat history' },
    { command: '/metrics', description: 'Show token usage metrics' },
  ];

  /** Active index for keyboard navigation */
  let activeIndex = 0;

  /** All available commands: agent commands + built-in */
  $: agentCommands = $agents.map((a) => ({
    command: `/ask-${a.id}`,
    description: a.description || `Ask ${a.name}`,
  }));

  /** Merged and filtered command list */
  $: allCommands = [...agentCommands, ...BUILTIN_COMMANDS];
  $: filteredCommands = filterCommands(allCommands, filter);

  /** Reset active index when filter changes */
  $: if (filter !== undefined) activeIndex = 0;

  /** Filter commands by partial match on command name */
  function filterCommands(
    commands: Array<{ command: string; description: string }>,
    query: string,
  ): Array<{ command: string; description: string }> {
    if (!query || query === '/') return commands;
    const lower = query.toLowerCase();
    return commands.filter((c) =>
      c.command.toLowerCase().includes(lower),
    );
  }

  /** Handle keyboard navigation */
  export function handleKey(event: KeyboardEvent): boolean {
    if (!visible) return false;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, filteredCommands.length - 1);
        return true;
      case 'ArrowUp':
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        return true;
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        selectCurrent();
        return true;
      case 'Escape':
        event.preventDefault();
        dispatch('close');
        return true;
      default:
        return false;
    }
  }

  /** Select the currently highlighted command */
  function selectCurrent(): void {
    const cmd = filteredCommands[activeIndex];
    if (cmd) dispatch('select', { command: cmd.command });
  }

  /** Select a specific command by click */
  function selectCommand(command: string): void {
    dispatch('select', { command });
  }
</script>

{#if visible && filteredCommands.length > 0}
  <div
    class="autocomplete-popup"
    role="listbox"
    aria-label="Slash commands"
    aria-activedescendant="cmd-{activeIndex}"
  >
    {#each filteredCommands as cmd, i (cmd.command)}
      <div
        id="cmd-{i}"
        class="autocomplete-item"
        class:active={i === activeIndex}
        role="option"
        aria-selected={i === activeIndex}
        on:click={() => selectCommand(cmd.command)}
        on:mouseenter={() => { activeIndex = i; }}
      >
        <span class="cmd-name">{cmd.command}</span>
        <span class="cmd-desc">{cmd.description}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .autocomplete-popup {
    position: absolute;
    bottom: 100%;
    left: 12px;
    right: 12px;
    margin-bottom: 4px;
    background: var(--vscode-editorSuggestWidget-background, #252526);
    border: 1px solid var(--vscode-editorSuggestWidget-border, #454545);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    max-height: 180px;
    overflow-y: auto;
    z-index: 200;
    padding: 4px 0;
  }
  .autocomplete-item {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
  }
  .autocomplete-item:hover,
  .autocomplete-item.active {
    background: var(--vscode-editorSuggestWidget-selectedBackground, #094771);
    color: var(--vscode-editorSuggestWidget-selectedForeground, #fff);
  }
  .cmd-name {
    font-family: var(--vscode-editor-font-family, monospace);
    font-weight: 500;
    flex-shrink: 0;
  }
  .cmd-desc {
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }
</style>
