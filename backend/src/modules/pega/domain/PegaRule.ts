/**
 * PegaRule — Lớp trừu tượng cha cho tất cả các Pega Rule (kế thừa Rule-).
 */

import { PegaObject } from './PegaObject.js';
import type { UnresolvedDependency } from '../models.js';
import type { UiStepAction } from '../PegaActionPlanGenerator.js';

export abstract class PegaRule extends PegaObject {
  constructor(
    pxObjClass: string,
    public readonly pyClassName: string,
    public readonly pyRuleName: string,
    public readonly pyRuleset?: string,
    public readonly pyRulesetVersion?: string,
    pyInsKey?: string,
  ) {
    super(pxObjClass, pyInsKey);
  }

  public isRule(): boolean {
    return true;
  }

  public getFqn(): string {
    return `${this.pxObjClass}:${this.pyClassName}:${this.pyRuleName}`;
  }

  public abstract extractDependencies(): UnresolvedDependency[];
  public abstract toStructuredPseudoCode(): string;
  public abstract generateUiAutomationPlan(): UiStepAction[];

  public toCanonicalJson(): Record<string, unknown> {
    return {
      pxObjClass: this.pxObjClass,
      pyClassName: this.pyClassName,
      pyRuleName: this.pyRuleName,
      pyRuleset: this.pyRuleset,
      pyRulesetVersion: this.pyRulesetVersion,
      fqn: this.getFqn(),
    };
  }
}
