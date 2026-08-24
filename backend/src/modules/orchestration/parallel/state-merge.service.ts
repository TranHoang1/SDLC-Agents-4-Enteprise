import type { PipelineState } from './fan-out.node.js';

export interface IMergeStrategy {
  merge(states: PipelineState[]): PipelineState;
}

export class DeepMergeStrategy implements IMergeStrategy {
  private static readonly DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  private static readonly MAX_DEPTH = 10;

  merge(states: PipelineState[]): PipelineState {
    if (states.length === 0) return {} as PipelineState;
    let base: PipelineState;
    try {
      base = structuredClone(states[0]) as PipelineState;
    } catch {
      base = {} as PipelineState;
    }
    const seen = new WeakSet<object>();
    for (let i = 1; i < states.length; i++) {
      this.mergeObjects(base, states[i], 0, seen);
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
          try {
            target[key] = structuredClone(srcVal);
          } catch {
            target[key] = {};
          }
        }
        this.mergeObjects(target[key], srcVal, depth + 1, seen);
      } else {
        // Immutable assignment via clone for primitives/arrays
        try {
          target[key] = Array.isArray(srcVal) ? structuredClone(srcVal) : srcVal;
        } catch {
          target[key] = srcVal;
        }
      }
    }
  }
}

export class LastWriteWinsStrategy implements IMergeStrategy {
  private static readonly DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  merge(states: PipelineState[]): PipelineState {
    const result = {} as PipelineState;
    for (const s of states) {
      if (!s || typeof s !== 'object') continue;
      let clone;
      try {
        clone = structuredClone(s);
      } catch {
        continue;
      }
      for (const key of Object.keys(clone)) {
        if (LastWriteWinsStrategy.DANGEROUS_KEYS.has(key)) continue;
        // Assign via structured clone to ensure immutability
        try {
          result[key] = structuredClone((clone as any)[key]);
        } catch {
          result[key] = (clone as any)[key];
        }
      }
    }
    return result;
  }
}

export class StateMergeService {
  constructor(private strategy: IMergeStrategy = new DeepMergeStrategy()) {}

  setStrategy(strategy: IMergeStrategy): void {
    this.strategy = strategy;
  }

  merge(states: PipelineState[]): PipelineState {
    return this.strategy.merge(states);
  }
}
