/**
 * DataTransformParserStrategy — Chiến lược trích xuất cho Rule-Obj-Model (Data Transform).
 */

import type { IPegaRuleParserStrategy, ParseResult } from './IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';
import { PegaLogicNormalizer } from '../PegaLogicNormalizer.js';

export class DataTransformParserStrategy implements IPegaRuleParserStrategy {
  public supports(pxObjClass: string): boolean {
    return pxObjClass === 'Rule-Obj-Model';
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const className = (json.pyClassName as string) || '@baseclass';
    const name = (json.pyModelName as string) || (json.pyTransformName as string) || (json.pyLabel as string) || 'UnnamedTransform';
    const fqn = `Rule-Obj-Model:${className}:${name}`;

    const symbol = {
      fqn,
      name,
      className,
      ruleType: 'Rule-Obj-Model',
      isRule: true,
      ruleset: (json.pyRuleSet as string) || (json.pyRuleset as string) || undefined,
      version: (json.pyRuleSetVersion as string) || (json.pyRulesetVersion as string) || undefined,
      logicSummary: PegaLogicNormalizer.normalizeDataTransform(json),
    };

    const dependencies = this.extractActions(json);
    return { symbol, dependencies };
  }

  private extractActions(json: Record<string, unknown>): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const actions = Array.isArray(json.pyActions) ? json.pyActions : [];

    for (const act of actions) {
      if (typeof act !== 'object' || !act) continue;
      this.parseAction(act as Record<string, unknown>, deps);
    }
    return deps;
  }

  private parseAction(act: Record<string, unknown>, deps: UnresolvedDependency[]): void {
    const actionType = act.pyActionType as string | undefined;
    const target = act.pyTarget as string | undefined;

    if (actionType === 'Apply Data Transform' && target) {
      deps.push({ ruleType: 'Rule-Obj-Model', className: '@baseclass', ruleName: target });
    }
  }
}
