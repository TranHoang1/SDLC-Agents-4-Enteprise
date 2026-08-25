export interface PipelineState {
  job_id: string;
  phases: string[];
  branchErrors?: BranchError[];
  [key: string]: unknown;
}

export interface BranchError {
  branch_id: string;
  error_code?: string;
  error_message?: string;
}

export interface FanOutResult {
  branch_id: string;
  state: PipelineState;
}

export class FanOutNode {
  private static readonly DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  private static readonly BRANCH_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

  private static validateBranchId(branchId: string): void {
    if (!FanOutNode.BRANCH_ID_PATTERN.test(branchId)) {
      throw new Error('Invalid branch_id format');
    }
    if (FanOutNode.DANGEROUS_KEYS.has(branchId)) {
      throw new Error('Invalid branch_id');
    }
  }

  createSnapshots(state: PipelineState, branchIds: string[]): FanOutResult[] {
    if (!Array.isArray(branchIds)) {
      throw new Error('branchIds must be an array');
    }
    return branchIds.map(id => {
      FanOutNode.validateBranchId(id);
      return {
        branch_id: id,
        state: this.cloneState(state, id),
      };
    });
  }

  private cloneState(state: PipelineState, branchId: string): PipelineState {
    FanOutNode.validateBranchId(branchId);
    const clone = structuredClone(state) as PipelineState;
    Object.defineProperty(clone, 'branch_id', {
      value: branchId,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return clone;
  }
}
