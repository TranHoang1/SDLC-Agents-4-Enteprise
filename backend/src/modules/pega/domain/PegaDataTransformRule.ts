/**
 * PegaDataTransformRule — Đối tượng OOP chuyên biệt cho Rule-Obj-Model (Data Transform).
 */

import { PegaRule } from './PegaRule.js';
import type { UnresolvedDependency } from '../models.js';
import type { UiStepAction } from '../PegaActionPlanGenerator.js';
import { PegaLogicNormalizer } from '../PegaLogicNormalizer.js';

export class PegaDataTransformRule extends PegaRule {
  constructor(
    pyClassName: string,
    pyModelName: string,
    public readonly rawJson: Record<string, unknown>,
    pyRuleset?: string,
    pyRulesetVersion?: string,
  ) {
    super('Rule-Obj-Model', pyClassName, pyModelName, pyRuleset, pyRulesetVersion);
  }

  public extractDependencies(): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const actions = Array.isArray(this.rawJson.pyActions) ? this.rawJson.pyActions : [];

    for (const act of actions) {
      if (typeof act !== 'object' || !act) continue;
      const target = (act as any).pyTarget as string | undefined;
      const actionType = (act as any).pyActionType as string | undefined;
      const transformName = (act as any).pyTransformName || (actionType === 'Apply Data Transform' ? target : undefined);
      const whenCondition = (act as any).pyWhenCondition as string | undefined;

      if (transformName) {
        deps.push({ ruleType: 'Rule-Obj-Model', className: this.pyClassName, ruleName: transformName });
      }
      if (whenCondition) {
        deps.push({ ruleType: 'Rule-Obj-When', className: this.pyClassName, ruleName: whenCondition });
      }
    }
    return deps;
  }

  public toStructuredPseudoCode(): string {
    return PegaLogicNormalizer.normalizeDataTransform(this.rawJson);
  }

  public generateUiAutomationPlan(): UiStepAction[] {
    const out: UiStepAction[] = [];
    const actions = Array.isArray(this.rawJson.pyActions) ? this.rawJson.pyActions : [];
    let idx = 1;

    for (const act of actions) {
      if (typeof act !== 'object' || !act) continue;
      const a = act as Record<string, unknown>;
      const rowId = (a.pyActionId as string) || `ACTION-${idx++}`;
      const actionType = (a.pyActionType as string) || 'Set';
      const target = (a.pyTarget as string) || '';
      const source = (a.pySource as string) || (a.pyTransformName as string) || '';

      out.push({
        action: 'CLICK_ADD_STEP',
        rowId,
        selectorHint: `button#addDTActionBtn`,
        description: `Click button Add DT Action for ${rowId}`,
      });
      out.push({
        action: 'SET_STEP_METHOD',
        rowId,
        value: actionType,
        selectorHint: `tr[data-actionid="${rowId}"] select[name$="pyActionType"]`,
        description: `Set Action Type to "${actionType}" on ${rowId}`,
      });
      if (target) {
        out.push({
          action: 'SET_STEP_CONTEXT',
          rowId,
          value: target,
          selectorHint: `tr[data-actionid="${rowId}"] input[name$="pyTarget"]`,
          description: `Set Target to "${target}" on ${rowId}`,
        });
      }
      if (source) {
        out.push({
          action: 'SET_STEP_PARAMS',
          rowId,
          value: source,
          selectorHint: `tr[data-actionid="${rowId}"] input[name$="pySource"]`,
          description: `Set Source to "${source}" on ${rowId}`,
        });
      }
    }
    return out;
  }
}
