/**
 * SA4E-191 — /agents command handler (UC-1, BR-7).
 * Lists agents from SA4E-186, shows the picker, and updates the active agent.
 */
import type { CommandContext, CommandHandler, CommandResult, SlashCommandUI } from '../types';
import type { AgentRouterAdapter } from '../adapters/sa4e186AgentRoutingAdapter';
import type { SessionStore } from '../stores/sessionStore';
import { ok, err } from '../results';

export class AgentsCommand implements CommandHandler {
  constructor(
    private readonly adapter: AgentRouterAdapter,
    private readonly session: SessionStore,
    private readonly ui: SlashCommandUI
  ) {}

  async execute(ctx: CommandContext): Promise<CommandResult> {
    let agents: string[];
    try {
      agents = await this.adapter.listAgents();
    } catch {
      return err(ctx, 'AGENT_ROUTING_UNAVAILABLE', 'Agent switching is temporarily unavailable.', true);
    }
    if (!agents || agents.length === 0) {
      return err(ctx, 'AGENT_ROUTING_UNAVAILABLE', 'Agent switching is temporarily unavailable.', true);
    }

    const selected = await this.ui.pickAgent(agents);
    if (!selected) {
      // AF-1: user cancelled — no change, menu closes silently.
      return ok(ctx, { activeAgentId: this.session.get().activeAgentId });
    }
    if (!agents.includes(selected)) {
      // EF-2: selected agent not in available set.
      return err(ctx, 'INVALID_AGENT', 'Selected agent is not available.', false);
    }

    this.session.setActiveAgent(selected);
    return ok(
      ctx,
      { activeAgentId: selected, availableAgents: agents },
      { type: 'toast', message: `Active agent switched to ${selected}.` }
    );
  }
}
