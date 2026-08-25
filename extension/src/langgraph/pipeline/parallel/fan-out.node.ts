import type { PipelineState } from "../../core/state";

export interface FanOutResult {
  branch_id: string;
  state: PipelineState;
}

export class FanOutNode {
  private static readonly BRANCH_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

  private static validateBranchId(branchId: string): void {
    if (!FanOutNode.BRANCH_ID_PATTERN.test(branchId)) {
      throw new Error('Invalid branch_id format');
    }
  }

  createSnapshots(state: PipelineState, branchIds: string[]): FanOutResult[] {
    if (!Array.isArray(branchIds)) {
      throw new Error('branchIds must be an array');
    }
    return branchIds.map(id => {
      FanOutNode.validateBranchId(id);
      const clone = structuredClone(state);
      (clone as any).branch_id = id;
      return { branch_id: id, state: clone };
    });
  }
}
