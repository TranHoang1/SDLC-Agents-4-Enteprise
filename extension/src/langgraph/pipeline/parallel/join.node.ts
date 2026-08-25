import type { PipelineState } from "../../core/state";
import { StateMergeService } from "./state-merge.service";

export interface JoinResult {
  state: PipelineState;
  completed: number;
  failed: number;
}

export class JoinNode {
  private mergeService: StateMergeService;

  constructor(mergeService?: StateMergeService) {
    this.mergeService = mergeService ?? new StateMergeService();
  }

  async join(states: PipelineState[]): Promise<JoinResult> {
    const merged = this.mergeService.merge(states);
    const failed = states.filter(s => (s as any).branchErrors?.length > 0).length;
    return {
      state: merged,
      completed: states.length - failed,
      failed,
    };
  }
}
