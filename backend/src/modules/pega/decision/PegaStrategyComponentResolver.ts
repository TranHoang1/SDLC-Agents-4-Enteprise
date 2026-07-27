export interface StrategyReference {
  type: 'decision_rule' | 'adaptive_model';
  ref: string;
  resolved: boolean;
}

export class PegaStrategyComponentResolver {
  resolve(ref: string): StrategyReference {
    if (ref.startsWith('AdaptiveModel:') || ref.startsWith('adaptive:')) {
      return {
        type: 'adaptive_model',
        ref,
        resolved: false,
      };
    }

    if (ref.startsWith('DecisionTree:') || ref.startsWith('DecisionTable:')) {
      return {
        type: 'decision_rule',
        ref,
        resolved: false,
      };
    }

    return {
      type: 'decision_rule',
      ref,
      resolved: false,
    };
  }

  resolveWithContext(ref: string, _context: Record<string, unknown>): unknown {
    const resolved = this.resolve(ref);

    if (resolved.type === 'adaptive_model') {
      throw new Error('Adaptive model execution not implemented: ' + ref);
    }

    return resolved;
  }
}