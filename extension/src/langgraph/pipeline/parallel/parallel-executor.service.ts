import type { PipelineState } from "../../core/state";
import { FanOutNode } from "./fan-out.node";

export interface BranchExecutor {
  execute(state: PipelineState): Promise<PipelineState>;
}

export class ParallelExecutor {
  private static readonly DEFAULT_CONCURRENCY = 5;
  private static readonly DEFAULT_TIMEOUT_MS = 10000;
  private static readonly MAX_ERROR_MESSAGE_LENGTH = 500;
  private static readonly MAX_BRANCHES = 100;
  private static readonly MAX_CONCURRENCY = 20;
  private static readonly BRANCH_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

  constructor(private fanOutNode: FanOutNode = new FanOutNode(), private concurrency = ParallelExecutor.DEFAULT_CONCURRENCY, private timeoutMs = ParallelExecutor.DEFAULT_TIMEOUT_MS) {
    if (concurrency < 1 || concurrency > ParallelExecutor.MAX_CONCURRENCY) throw new Error(`concurrency must be between 1 and ${ParallelExecutor.MAX_CONCURRENCY}`);
  }

  private sanitizeMessage(msg: unknown): string {
    if (typeof msg !== 'string') return 'Unknown error';
    const cleaned = msg.replace(/[\r\n]+/g, ' ').trim();
    return cleaned.slice(0, ParallelExecutor.MAX_ERROR_MESSAGE_LENGTH);
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Execution timeout')), ms))]);
  }

  private async runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;
    const workers = new Array(Math.min(limit, tasks.length)).fill(null).map(async () => {
      while (true) {
        const current = index++;
        if (current >= tasks.length) break;
        results[current] = await tasks[current]();
      }
    });
    await Promise.all(workers);
    return results;
  }

  async execute(state: PipelineState, branchIds: string[], executor: BranchExecutor): Promise<PipelineState[]> {
    if (!Array.isArray(branchIds) || branchIds.length === 0) throw new Error('Invalid branchIds');
    if (branchIds.length > ParallelExecutor.MAX_BRANCHES) throw new Error('branchIds exceeds maximum allowed');
    for (const id of branchIds) {
      if (typeof id !== 'string' || !ParallelExecutor.BRANCH_ID_PATTERN.test(id)) throw new Error('Invalid branch_id format');
    }
    const snapshots = this.fanOutNode.createSnapshots(state, branchIds);
    const tasks = snapshots.map((s, i) => async () => {
      try {
        const execPromise = executor.execute(s.state);
        const value = await this.withTimeout(execPromise, this.timeoutMs);
        return { status: 'fulfilled' as const, value: structuredClone(value) };
      } catch (reason) {
        const errState = structuredClone(snapshots[i].state) as PipelineState;
        (errState as any).branchErrors = (errState as any).branchErrors || [];
        (errState as any).branchErrors.push({ branch_id: snapshots[i].branch_id, error_code: 'ERR_EXECUTION', error_message: this.sanitizeMessage(reason instanceof Error ? reason.message : String(reason)) });
        return { status: 'rejected' as const, value: errState };
      }
    });
    const settled = await this.runWithConcurrency(tasks, this.concurrency);
    return settled.map(r => r.value);
  }
}
