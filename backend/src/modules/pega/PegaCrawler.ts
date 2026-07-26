import { PegaSchemaLoader } from './PegaSchemaLoader.js';
import type { UnresolvedDependency } from './models.js';
import type { PegaRuleKbSchema } from './strategies/KbDrivenPegaParserStrategy.js';

export interface PegaCrawlKey {
  insKey: string;
  pxObjClass: string;
  pyClassName: string;
  pyRuleName: string;
}

export interface PegaCrawlPlan {
  missing: PegaCrawlKey[];
  cached: string[];
}

export interface PegaCrawlBatchRequest {
  projectId: string;
  rules: Record<string, unknown>[];
  visitedKeys: string[];
}

export interface PegaCrawlBatchResponse {
  stored: number;
  nextBatch: PegaCrawlKey[];
}

export class PegaCrawler {
  private schemaMap = new Map<string, PegaRuleKbSchema>();

  constructor() {
    this.loadSchemas();
  }

  private loadSchemas(): void {
    const schemas = PegaSchemaLoader.loadAllSchemas();
    for (const s of schemas) {
      this.schemaMap.set(s.targetClass, s);
    }
  }

  public plan(ruleKeys: string[], visitedKeys: Set<string>): PegaCrawlPlan {
    const missing: PegaCrawlKey[] = [];
    const cached: string[] = [];

    for (const key of ruleKeys) {
      if (visitedKeys.has(key)) {
        cached.push(key);
        continue;
      }
      const parsed = this.parseInsKey(key);
      if (!parsed) {
        cached.push(key);
        continue;
      }
      missing.push(parsed);
    }

    return { missing, cached };
  }

  public computeNextBatch(
    ingestedRules: Record<string, unknown>[],
    visitedKeys: Set<string>,
    projectId: string,
  ): PegaCrawlKey[] {
    const nextBatch: PegaCrawlKey[] = [];
    const seen = new Set<string>();

    for (const rule of ingestedRules) {
      const deps = this.extractRuleReferences(rule);
      for (const dep of deps) {
        const insKey = `${dep.ruleType} ${dep.ruleName}`;
        if (visitedKeys.has(insKey) || seen.has(insKey)) continue;
        seen.add(insKey);
        nextBatch.push({
          insKey,
          pxObjClass: dep.ruleType,
          pyClassName: dep.className,
          pyRuleName: dep.ruleName,
        });
      }
    }

    return nextBatch;
  }

  public parseInsKey(insKey: string): PegaCrawlKey | null {
    // Format: "RULE-OBJ-CLASS ClassName" or "RULE-OBJ-PROPERTY PropertyName"
    const spaceIdx = insKey.indexOf(' ');
    if (spaceIdx === -1) return null;
    const pxObjClass = insKey.substring(0, spaceIdx).trim();
    const pyRuleName = insKey.substring(spaceIdx + 1).trim();
    if (!pxObjClass || !pyRuleName) return null;

    let pyClassName = '@baseclass';
    const dotIdx = pyRuleName.lastIndexOf('.');
    if (dotIdx !== -1) {
      pyClassName = pyRuleName.substring(0, dotIdx);
    }

    return {
      insKey,
      pxObjClass: this.normalizeObjClass(pxObjClass),
      pyClassName,
      pyRuleName,
    };
  }

  private normalizeObjClass(raw: string): string {
    if (raw.startsWith('RULE-OBJ-')) {
      return 'Rule-' + raw.charAt(5).toUpperCase() + raw.substring(6).replace(/-/g, '-');
    }
    return raw;
  }

  private extractRuleReferences(json: Record<string, unknown>): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const visited = new Set<string>();

    const pushDep = (ruleType: string, className: string, ruleName: string) => {
      const key = `${ruleType}:${className}:${ruleName}`;
      if (visited.has(key)) return;
      visited.add(key);
      deps.push({ ruleType, className, ruleName });
    };

    if (json.pxObjClass) {
      pushDep(json.pxObjClass as string, json.pyClassName as string || '@baseclass', json.pyRuleName as string || '');
    }

    if (json.pyClassName && json.pyClassName !== '@baseclass') {
      pushDep('Rule-Obj-Class', '@baseclass', json.pyClassName as string);
    }

    if (json.pySuperClass) {
      pushDep('Rule-Obj-Class', '@baseclass', json.pySuperClass as string);
    }

    if (json.pyPatternParent) {
      pushDep('Rule-Obj-Class', '@baseclass', json.pyPatternParent as string);
    }

    if (json.pyDerivesFrom) {
      pushDep('Rule-Obj-Class', '@baseclass', json.pyDerivesFrom as string);
    }

    const pxRuleReferences = json.pxRuleReferences;
    if (Array.isArray(pxRuleReferences)) {
      for (const ref of pxRuleReferences) {
        if (ref && typeof ref === 'object') {
          const r = ref as Record<string, unknown>;
          const refCls = (r.pxRuleObjClass || r.pxRuleClassName) as string | undefined;
          const refName = r.pyRuleName as string | undefined;
          if (refCls && refName) {
            pushDep(refCls, (r.pxRuleClassName as string) || '@baseclass', refName);
          }
        }
      }
    }

    const steps = json.steps || json.pySteps;
    if (Array.isArray(steps)) {
      for (const step of steps) {
        if (typeof step !== 'object' || !step) continue;
        const s = step as Record<string, unknown>;
        const method = (s.pyMethod as string) || '';
        const params = (s.pyMethodParameters as string) || '';

        if ((method === 'Call' || method === 'Branch') && params) {
          const parts = params.split('.');
          if (parts.length >= 2) {
            pushDep('Rule-Obj-Activity', parts[0], parts[1]);
          } else {
            pushDep('Rule-Obj-Activity', '@baseclass', params);
          }
        }

        if (method === 'Property-Set' && params && params.includes('.')) {
          const dot = params.lastIndexOf('.');
          const cls = params.substring(0, dot);
          const prop = params.substring(dot + 1);
          if (cls && prop) {
            pushDep('Rule-Obj-Property', cls, prop);
          }
        }
      }
    }

    const pages = json.pyPagesAndClasses || json.pxPagesAndClasses;
    if (Array.isArray(pages)) {
      for (const p of pages) {
        if (p && typeof p === 'object') {
          const page = p as Record<string, unknown>;
          const pageClass = (page.pyPagesAndClassesClass || page.pxPagesAndClassesClass) as string | undefined;
          if (pageClass && pageClass !== '@baseclass' && !pageClass.startsWith('Code-') && !pageClass.startsWith('Data-')) {
            pushDep('Rule-Obj-Class', '@baseclass', pageClass);
          }
        }
      }
    }

    const flowActions = json.pyFlowActions;
    if (Array.isArray(flowActions)) {
      for (const fa of flowActions) {
        if (fa && typeof fa === 'object') {
          const f = fa as Record<string, unknown>;
          if (f.pyFlowActionName) {
            pushDep('Rule-Obj-FlowAction', (json.pyClassName as string) || '@baseclass', f.pyFlowActionName as string);
          }
        }
      }
    }

    return deps;
  }
}
