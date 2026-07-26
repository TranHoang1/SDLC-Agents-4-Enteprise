/**
 * PegaActionPlanGenerator — Tạo Kế Hoạch Tự Động Hóa UI (Browser Automation Plan)
 * giúp Browser Agent mở Pega Dev Studio và thao tác thêm/sửa/xóa các dòng Step trên Pega Studio.
 */

export interface UiStepAction {
  action: 'CLICK_ADD_STEP' | 'SET_STEP_METHOD' | 'SET_STEP_CONTEXT' | 'SET_STEP_PARAMS' | 'SET_CONDITION';
  rowId: string;
  selectorHint: string;
  value?: string;
  description: string;
}

export interface PegaBrowserPlan {
  ruleFqn: string;
  targetUrlHint: string;
  preRequisites: string[];
  uiSteps: UiStepAction[];
}

export class PegaActionPlanGenerator {
  public static generatePlan(json: Record<string, unknown>): PegaBrowserPlan {
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Obj-Activity';
    const className = (json.pyClassName as string) || '@baseclass';
    const name = (json.pyActivityName as string) || (json.pyModelName as string) || 'Unnamed';
    const fqn = `${pxObjClass}:${className}:${name}`;

    const preRequisites = [
      'Navigate to Pega Dev Studio Home',
      `Search Rule in Header Search Bar: ${name}`,
      'Open Rule and Click "Checkout" if Rule is locked',
    ];

    const uiSteps: UiStepAction[] = [];
    if (pxObjClass === 'Rule-Obj-Activity') {
      PegaActionPlanGenerator.buildActivityUiSteps(json, uiSteps);
    }

    return {
      ruleFqn: fqn,
      targetUrlHint: `/prweb/PRServlet?pyActivity=WB-Developer.OpenRule&pyObjClass=${pxObjClass}&pyClassName=${className}&pyRuleName=${name}`,
      preRequisites,
      uiSteps,
    };
  }

  private static buildActivityUiSteps(json: Record<string, unknown>, out: UiStepAction[]): void {
    const steps = Array.isArray(json.steps) ? json.steps : [];
    let idx = 1;
    for (const step of steps) {
      if (typeof step !== 'object' || !step) continue;
      const rowId = (step.pyStepId as string) || `ROW-${idx++}`;
      const method = (step.pyMethod as string) || 'Property-Set';
      const context = (step.pyStepContext as string) || 'Primary';
      const params = (step.pyMethodParameters as string) || '';

      out.push({
        action: 'CLICK_ADD_STEP',
        rowId,
        selectorHint: `table#stepsTable button[data-click*="addStep"]`,
        description: `Click button "Add Step" to insert ${rowId}`,
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
        description: `Set Step Context to "${context}" on ${rowId}`,
      });
      if (params) {
        out.push({
          action: 'SET_STEP_PARAMS',
          rowId,
          value: params,
          selectorHint: `tr[data-rowid="${rowId}"] input[name$="pyMethodParameters"]`,
          description: `Set Method Parameters to "${params}" on ${rowId}`,
        });
      }
    }
  }
}
