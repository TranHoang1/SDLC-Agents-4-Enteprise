/**
 * SA4E-191 — /review command handler (UC-6, BR-5).
 * Owner-only (BR-5/EF-3). Captures branch diff (from args or VCS provider),
 * resolves the review agent via SA4E-186, and streams findings. Missing diff
 * -> EF-1; unavailable agent -> EF-2.
 */
import type { CommandContext, CommandHandler, CommandResult, SlashCommandUI } from '../types';
import type { AgentRouterAdapter } from '../adapters/sa4e186AgentRoutingAdapter';
import { ok, err } from '../results';

/** VCS provider boundary — resolves the current branch diff. */
export interface VcsProvider {
  resolveBranchDiff(): Promise<{ branchName: string; branchDiff: string } | null>;
}

export class UnavailableVcsProvider implements VcsProvider {
  async resolveBranchDiff(): Promise<{ branchName: string; branchDiff: string } | null> {
    return null;
  }
}

export class ReviewCommand implements CommandHandler {
  constructor(
    private readonly adapter: AgentRouterAdapter,
    private readonly vcs: VcsProvider,
    private readonly ui: SlashCommandUI
  ) {}

  async execute(ctx: CommandContext): Promise<CommandResult> {
    // BR-5 / EF-3 — non-owner denied.
    if (ctx.session.userId !== ctx.session.ownerId) {
      return err(ctx, 'PERMISSION_DENIED', 'Permission denied.', false);
    }

    let branchName = (ctx.args.branchName as string | undefined) ?? undefined;
    let branchDiff = (ctx.args.branchDiff as string | undefined) ?? undefined;
    if (!branchDiff) {
      try {
        const info = await this.vcs.resolveBranchDiff();
        if (info) {
          branchName = info.branchName;
          branchDiff = info.branchDiff;
        }
      } catch {
        // ignore — fall through to EF-1
      }
    }

    // EF-1: no diff available.
    if (!branchDiff) {
      return err(ctx, 'BRANCH_DIFF_UNAVAILABLE', 'Unable to obtain branch diff for review.', false);
    }

    let agentId: string | null;
    try {
      agentId = await this.adapter.resolve('review_agent');
    } catch {
      agentId = null;
    }
    // EF-2: review agent unavailable.
    if (!agentId) {
      return err(ctx, 'REVIEW_AGENT_UNAVAILABLE', 'Review agent is currently unavailable.', true);
    }

    let report: { findings: string[] };
    try {
      report = await this.adapter.runReview(branchDiff);
    } catch {
      return err(ctx, 'REVIEW_AGENT_UNAVAILABLE', 'Review agent is currently unavailable.', true);
    }

    this.ui.showChatBlock(report.findings);
    return ok(ctx, { reviewFindings: report.findings }, { type: 'chatBlock', streaming: true });
  }
}
