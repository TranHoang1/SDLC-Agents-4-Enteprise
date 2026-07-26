/**
 * PegaActivityRule — Đối tượng OOP chuyên biệt cho Rule-Obj-Activity.
 */

import { PegaRule } from './PegaRule.js';
import type { UnresolvedDependency } from '../models.js';
import type { UiStepAction } from '../PegaActionPlanGenerator.js';
import { PegaLogicNormalizer } from '../PegaLogicNormalizer.js';

export class PegaActivityRule extends PegaRule {
  constructor(
    pyClassName: string,
    pyActivityName: string,
    public readonly rawJson: Record<string, unknown>,
    pyRuleset?: string,
    pyRulesetVersion?: string,
  ) {
    super('Rule-Obj-Activity', pyClassName, pyActivityName, pyRuleset, pyRulesetVersion);
  }

  public extractDependencies(): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const steps = Array.isArray(this.rawJson.steps) ? this.rawJson.steps : [];

    for (const step of steps) {
      if (typeof step !== 'object' || !step) continue;
      const method = (step as any).pyMethod as string | undefined;
      const params = (step as any).pyMethodParameters as string | undefined;

      if ((method === 'Call' || method === 'Branch') && params) {
        const parts = params.split('.');
        if (parts.length >= 2) {
          deps.push({ ruleType: 'Rule-Obj-Activity', className: parts[0], ruleName: parts[1] });
        } else {
          deps.push({ ruleType: 'Rule-Obj-Activity', className: '@baseclass', ruleName: params });
        }
      }
    }
    return deps;
  }

  public toStructuredPseudoCode(): string {
    return PegaLogicNormalizer.normalizeActivity(this.rawJson);
  }

  public generateUiAutomationPlan(): UiStepAction[] {
    const out: UiStepAction[] = [];
    const steps = Array.isArray(this.rawJson.steps) ? this.rawJson.steps : [];
    let idx = 1;

    for (const step of steps) {
      if (typeof step !== 'object' || !step) continue;
      const s = step as Record<string, unknown>;
      const rowId = (s.pyStepId as string) || `ROW-${idx++}`;
      const method = (s.pyMethod as string) || 'Property-Set';
      const context = (s.pyStepContext as string) || 'Primary';
      const params = (s.pyMethodParameters as string) || '';

      out.push({
        action: 'CLICK_ADD_STEP',
        rowId,
        selectorHint: `table#stepsTable button[data-click*="addStep"]`,
        description: `Click button Add Step for ${rowId}`,
      });
      out.push({
        action: 'SET_STEP_METHOD',
        rowId,
        value: method,
        selectorHint: `tr[data-rowid="${rowId}"] input[name$="pyMethod"]`,
        description: `Set Method to "${method}" on ${rowId}`,
      });
      out.push({
        action: 'SET_STEP_CONTEXT',
        rowId,
        value: context,
        selectorHint: `tr[data-rowid="${rowId}"] input[name$="pyStepContext"]`,
        description: `Set Context to "${context}" on ${rowId}`,
      });
      if (params) {
        out.push({
          action: 'SET_STEP_PARAMS',
          rowId,
          value: params,
          selectorHint: `tr[data-rowid="${rowId}"] input[name$="pyMethodParameters"]`,
          description: `Set Parameters to "${params}" on ${rowId}`,
        });
      }
    }
    return out;
  }
}
