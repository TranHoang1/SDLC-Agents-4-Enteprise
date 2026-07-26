/**
 * PegaDeclarativeEngine — Bộ máy quản lý Declarative Processing Network (PRPC Inference Engine).
 * Quản lý Forward Chaining, Backward Chaining và Declare Triggers/OnChange.
 */

export interface DeclareExpressionNode {
  targetProperty: string;
  formula: string;
  inputProperties: string[];
}

export class PegaDeclarativeEngine {
  private expressions = new Map<string, DeclareExpressionNode>();

  public registerExpression(targetProperty: string, formula: string, inputProperties: string[]): void {
    this.expressions.set(targetProperty, { targetProperty, formula, inputProperties });
  }

  public findForwardImpact(sourceProperty: string): string[] {
    const impacted: string[] = [];
    const queue: string[] = [sourceProperty];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const [targetProp, expr] of this.expressions.entries()) {
        if (expr.inputProperties.includes(current) && !impacted.includes(targetProp)) {
          impacted.push(targetProp);
          queue.push(targetProp);
        }
      }
    }
    return impacted;
  }

  public findBackwardDependencies(targetProperty: string): string[] {
    const expr = this.expressions.get(targetProperty);
    if (!expr) return [];

    const deps: string[] = [];
    for (const input of expr.inputProperties) {
      deps.push(input);
      const subDeps = this.findBackwardDependencies(input);
      for (const sub of subDeps) {
        if (!deps.includes(sub)) deps.push(sub);
      }
    }
    return deps;
  }
}
