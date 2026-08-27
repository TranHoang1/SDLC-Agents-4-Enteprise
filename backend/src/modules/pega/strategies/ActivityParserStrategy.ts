/**
 * ActivityParserStrategy — Chiến lược trích xuất cho Rule-Obj-Activity.
 */

import type { IPegaRuleParserStrategy, ParseResult } from './IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';
import { PegaLogicNormalizer } from '../PegaLogicNormalizer.js';

export class ActivityParserStrategy implements IPegaRuleParserStrategy {
  public supports(pxObjClass: string): boolean {
    return pxObjClass === 'Rule-Obj-Activity';
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const className = (json.pyClassName as string) || '@baseclass';
    const name = (json.pyActivityName as string) || (json.pyLabel as string) || 'UnnamedActivity';
    const fqn = `Rule-Obj-Activity:${className}:${name}`;

    const symbol = {
      fqn,
      name,
      className,
      ruleType: 'Rule-Obj-Activity',
      isRule: true,
      ruleset: (json.pyRuleSet as string) || (json.pyRuleset as string) || undefined,
      version: (json.pyRuleSetVersion as string) || (json.pyRulesetVersion as string) || undefined,
      logicSummary: PegaLogicNormalizer.normalizeActivity(json),
    };

    const dependencies = this.extractSteps(json);
    return { symbol, dependencies };
  }

  private extractSteps(json: Record<string, unknown>): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const steps = Array.isArray(json.steps) ? json.steps : [];

    for (const step of steps) {
      if (typeof step !== 'object' || !step) continue;
      this.parseStep(step as Record<string, unknown>, deps);
    }
    return deps;
  }

  private parseStep(step: Record<string, unknown>, deps: UnresolvedDependency[]): void {
    const method = step.pyMethod as string | undefined;
    const params = step.pyMethodParameters as string | undefined;

    if ((method === 'Call' || method === 'Branch') && params) {
      const parts = params.split('.');
      if (parts.length >= 2) {
        deps.push({ ruleType: 'Rule-Obj-Activity', className: parts[0], ruleName: parts[1] });
      } else {
        deps.push({ ruleType: 'Rule-Obj-Activity', className: '@baseclass', ruleName: params });
      }
    }
  }
}
