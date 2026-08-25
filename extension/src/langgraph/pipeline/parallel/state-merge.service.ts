import type { PipelineState } from "../../core/state";

export interface IMergeStrategy {
  merge(states: PipelineState[]): PipelineState;
}

export class DeepMergeStrategy implements IMergeStrategy {
  private static readonly MAX_DEPTH = 10;
  private static readonly DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  merge(states: PipelineState[]): PipelineState {
    if (states.length === 0) return {} as PipelineState;
    let base: PipelineState;
    try { base = structuredClone(states[0]); } catch { base = {} as PipelineState; }
    const seen = new WeakSet<object>();
    for (let i = 1; i < states.length; i++) {
      this.mergeObjects(base as any, states[i] as any, 0, seen);
    }
    return base;
  }

  private mergeObjects(target: any, source: any, depth: number, seen: WeakSet<object>): void {
    if (depth > DeepMergeStrategy.MAX_DEPTH) return;
    if (!source || typeof source !== 'object') return;
    if (seen.has(source)) return;
    seen.add(source);
    for (const key of Object.keys(source)) {
      if (DeepMergeStrategy.DANGEROUS_KEYS.has(key)) continue;
      if (key === 'branch_id' || key === 'branchErrors') continue;
      const srcVal = source[key];
      if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          try { target[key] = structuredClone(srcVal); } catch { target[key] = {}; }
        }
        this.mergeObjects(target[key], srcVal, depth + 1, seen);
      } else {
        try { target[key] = Array.isArray(srcVal) ? structuredClone(srcVal) : srcVal; } catch { target[key] = srcVal; }
      }
    }
  }
}

export class StateMergeService {
  private strategy: IMergeStrategy;
  constructor(strategy: IMergeStrategy = new DeepMergeStrategy()) {
    this.strategy = strategy;
  }
  setStrategy(strategy: IMergeStrategy): void { this.strategy = strategy; }
  merge(states: PipelineState[]): PipelineState { return this.strategy.merge(states); }
}
