/**
 * PegaGenericRule — Đối tượng OOP linh hoạt cho các loại Pega Rule chưa có Class chuyên biệt.
 */

import { PegaRule } from './PegaRule.js';
import type { UnresolvedDependency } from '../models.js';
import type { UiStepAction } from '../PegaActionPlanGenerator.js';
import type { PegaRuleKbSchema } from '../strategies/KbDrivenPegaParserStrategy.js';

export class PegaGenericRule extends PegaRule {
  constructor(
    pxObjClass: string,
    pyClassName: string,
    pyRuleName: string,
    public readonly rawJson: Record<string, unknown>,
    public readonly schema?: PegaRuleKbSchema,
    pyRuleset?: string,
    pyRulesetVersion?: string,
  ) {
    super(pxObjClass, pyClassName, pyRuleName, pyRuleset, pyRulesetVersion);
  }

  public extractDependencies(): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const paths = this.schema?.dependencyPaths || [];

    for (const pathStr of paths) {
      if (pathStr.includes('[].')) {
        const [arrayProp, targetProp] = pathStr.split('[].');
        const arr = Array.isArray(this.rawJson[arrayProp]) ? (this.rawJson[arrayProp] as any[]) : [];
        for (const item of arr) {
          if (item && typeof item === 'object' && typeof item[targetProp] === 'string' && item[targetProp].trim()) {
            deps.push({ ruleType: 'Unknown', className: this.pyClassName, ruleName: item[targetProp].trim() });
          }
        }
      } else if (typeof this.rawJson[pathStr] === 'string' && (this.rawJson[pathStr] as string).trim()) {
        deps.push({ ruleType: 'Unknown', className: this.pyClassName, ruleName: (this.rawJson[pathStr] as string).trim() });
      }
    }
    return deps;
  }

  public toStructuredPseudoCode(): string {
    return `${this.pxObjClass}: ${this.pyClassName}.${this.pyRuleName}`;
  }

  public generateUiAutomationPlan(): UiStepAction[] {
    return [];
  }
}
