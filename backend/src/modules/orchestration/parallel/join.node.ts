import type { PipelineState, BranchError } from './fan-out.node.js';
import { StateMergeService, type IMergeStrategy } from './state-merge.service.js';
import { ErrorIsolationService, type IErrorIsolationPolicy } from './error-isolation.service.js';

export interface JoinResult {
  state: PipelineState;
  completed: number;
  failed: number;
}

export class JoinNode {
  constructor(
    private mergeService: StateMergeService,
    private errorService: ErrorIsolationService,
  ) {}

  async join(states: PipelineState[], policy: IErrorIsolationPolicy): Promise<JoinResult> {
    const failures = this.collectFailures(states);
    const shouldContinue = policy.shouldContinue(failures);
    if (!shouldContinue) {
      throw new Error('Join policy prevents continuation');
    }
    const merged = this.mergeService.merge(states);
    return {
      state: merged,
      completed: states.length - failures.length,
      failed: failures.length,
    };
  }

  private collectFailures(states: PipelineState[]): BranchError[] {
    const errors: BranchError[] = [];
    for (const s of states) {
      if (s.branchErrors) errors.push(...s.branchErrors);
    }
    return errors;
  }
}
