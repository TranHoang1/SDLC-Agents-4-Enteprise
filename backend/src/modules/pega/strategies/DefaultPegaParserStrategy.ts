/**
 * DefaultPegaParserStrategy — Chiến lược mặc định (Fallback) xử lý tất cả các Rule/Data khác.
 */

import type { IPegaRuleParserStrategy, ParseResult } from './IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';

export class DefaultPegaParserStrategy implements IPegaRuleParserStrategy {
  public supports(_pxObjClass: string): boolean {
    return true; // Match-all fallback
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Obj-Activity';
    const isRule = pxObjClass.startsWith('Rule-');
    const className = (json.pyClassName as string) || (json.className as string) || '@baseclass';
    const name = this.extractName(json);
    const fqn = `${pxObjClass}:${className}:${name}`;

    const symbol = {
      fqn,
      name,
      className,
      ruleType: pxObjClass,
      isRule,
      ruleset: (json.pyRuleSet as string) || (json.pyRuleset as string) || undefined,
      version: (json.pyRuleSetVersion as string) || (json.pyRulesetVersion as string) || undefined,
    };

    const dependencies: UnresolvedDependency[] = [];
    return { symbol, dependencies };
  }

  private extractName(json: Record<string, unknown>): string {
    return (
      (json.pyActivityName as string) ||
      (json.pyModelName as string) ||
      (json.pyRuleName as string) ||
      (json.pyUserIdentifier as string) ||
      (json.pyLabel as string) ||
      'Unnamed'
    );
  }
}
