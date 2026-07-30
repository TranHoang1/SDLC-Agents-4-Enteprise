import type { PegaRuleAst, AstNode } from '../PegaRuleAst.js';
import type { PegaClassDefinition } from '../metamodel/PegaClassDefinition.js';
import type { SemanticAnalysis, SideEffect, SemanticDep, ConditionSummary, DataFlowEntry } from './types.js';

const SIDE_EFFECT_API_CALL = new Set([
  'Call', 'Connect-REST', 'Connect-SOAP', 'Connect-SQL', 'Connect-File',
  'Rule-Connect-REST', 'Rule-Connect-SOAP', 'Rule-Connect-SQL',
]);

const SIDE_EFFECT_DB_WRITE = new Set([
  'Property-Set', 'Obj-Save', 'Obj-Delete', 'Commit', 'Save',
  'Obj-Open-And-Update',
]);

const SIDE_EFFECT_PAGE_UPDATE = new Set([
  'Property-Set', 'Property-Copy', 'Page-New', 'Page-Copy',
  'Obj-Open', 'Obj-Open-By-Handle',
]);

export class PegaSemanticAnalyzer {
  analyze(json: Record<string, unknown>): SemanticAnalysis {
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Obj-Activity';
    const name = this.extractName(json);

    switch (true) {
      case pxObjClass === 'Rule-Obj-Activity':
        return this.analyzeActivity(json);
      case pxObjClass === 'Rule-Obj-Model':
        return this.analyzeDataTransform(json);
      case pxObjClass === 'Rule-Obj-Flow':
        return this.analyzeFlow(json);
      case pxObjClass === 'Rule-Obj-Section' || pxObjClass.startsWith('Rule-HTML-') || pxObjClass.startsWith('Rule-UI-'):
        return this.analyzeSection(json);
      case pxObjClass === 'Rule-Declare-DecisionTable' || pxObjClass === 'Rule-Declare-DecisionTree' || pxObjClass.startsWith('Rule-Decision-'):
        return this.analyzeDecision(json);
      case pxObjClass.startsWith('Rule-Connect-') || pxObjClass.startsWith('Rule-Service-'):
        return this.analyzeConnect(json);
      case pxObjClass.startsWith('Rule-Declare-'):
        return this.analyzeDeclare(json);
      default: {
        const analysis: SemanticAnalysis = {
          ruleType: pxObjClass,
          name,
          summary: `This is a ${pxObjClass} rule named "${name}"`,
          intent: `Define a ${pxObjClass} configuration`,
          sideEffects: [],
          dependencies: [],
          conditions: [],
          dataFlow: [],
        };
        return analysis;
      }
    }
  }

  analyzeActivity(json: Record<string, unknown>): SemanticAnalysis {
    const name = this.extractName(json);
    const className = (json.pyClassName as string) || '';
    const label = (json.pyLabel as string) || name;
    const steps = Array.isArray(json.steps) ? json.steps : [];
    const stepDescs: string[] = [];
    const sideEffects: SideEffect[] = [];
    const dependencies: SemanticDep[] = [];
    const conditions: ConditionSummary[] = [];
    const dataFlow: DataFlowEntry[] = [];
    const calledActivities: string[] = [];
    const setProperties: string[] = [];

    for (const s of steps) {
      const step = s as Record<string, unknown>;
      const method = (step.pyMethod as string) || '';
      const params = (step.pyMethodParameters as string) || '';
      const stepLabel = (step.pyLabel as string) || '';
      const stepDesc = stepLabel || `${method} ${params}`;

      if (method === 'Call' || method === 'Branch') {
        const dotIdx = params.lastIndexOf('.');
        const calledClass = dotIdx >= 0 ? params.substring(0, dotIdx) : className;
        const calledName = dotIdx >= 0 ? params.substring(dotIdx + 1) : params;
        calledActivities.push(calledName);
        dependencies.push({
          type: 'activity',
          target: calledName,
          targetClass: calledClass,
          context: `Step calls ${calledName}`,
        });
        sideEffects.push({
          type: 'api_call',
          target: `${calledClass}.${calledName}`,
          detail: `Calls activity ${calledName}`,
        });
        stepDescs.push(`calls activity "${calledName}"`);
      } else if (method === 'Property-Set' || method === 'Property-Copy') {
        const target = params.replace(/^\./, '');
        if (target) {
          setProperties.push(target);
          sideEffects.push({
            type: 'page_update',
            target,
            detail: `Sets property ${target}`,
          });
          dataFlow.push({
            input: '',
            transform: `${method} -> ${target}`,
            output: target,
          });
          stepDescs.push(`sets property "${target}"`);
        }
      } else if (method === 'Obj-Save' || method === 'Save') {
        sideEffects.push({
          type: 'db_write',
          target: className || params,
          detail: `Saves object to database`,
        });
        stepDescs.push(`saves "${params}" to database`);
      } else if (method === 'Obj-Delete') {
        sideEffects.push({
          type: 'db_write',
          target: params,
          detail: `Deletes object from database`,
        });
        stepDescs.push(`deletes "${params}" from database`);
      } else if (method === 'Page-New') {
        sideEffects.push({
          type: 'page_update',
          target: params,
          detail: `Creates new page "${params}"`,
        });
        stepDescs.push(`creates new page "${params}"`);
      } else {
        stepDescs.push(stepDesc || `step ${steps.indexOf(s) + 1}`);
      }

      const when = step.pyWhenCondition as string;
      if (when) {
        conditions.push({
          field: when,
          operator: 'WHEN',
          value: true,
          description: `Guarded by when condition "${when}"`,
        });
      }
    }

    const summary = `This activity "${label}" ${steps.length === 0 ? 'has 0 step(s)' : `executes ${steps.length} step(s): ${stepDescs.join('; ')}`}.`;
    const intentParts: string[] = [];
    if (calledActivities.length > 0) intentParts.push(`calls ${calledActivities.length} sub-activity(ies)`);
    if (setProperties.length > 0) intentParts.push(`sets ${setProperties.length} property(ies)`);
    const intent = intentParts.length > 0 ? intentParts.join(' and ') : 'performs configured operations';

    return {
      ruleType: 'Rule-Obj-Activity',
      name,
      className,
      summary,
      intent,
      sideEffects,
      dependencies,
      conditions,
      dataFlow,
      steps: steps.length,
      calledActivities,
      setProperties,
    };
  }

  analyzeDataTransform(json: Record<string, unknown>): SemanticAnalysis {
    const name = this.extractName(json);
    const className = (json.pyClassName as string) || '';
    const label = (json.pyLabel as string) || name;
    const actions = Array.isArray(json.pyActions) ? json.pyActions : [];
    const mappings: { from: string; to: string; condition?: string }[] = [];
    const dependencies: SemanticDep[] = [];
    const conditions: ConditionSummary[] = [];
    const sideEffects: SideEffect[] = [];
    const dataFlow: DataFlowEntry[] = [];

    for (const a of actions) {
      const act = a as Record<string, unknown>;
      const actionType = (act.pyActionType as string) || '';
      const target = (act.pyTarget as string) || '';
      const source = (act.pySource as string) || '';

      if (actionType === 'Set' && target && source) {
        const from = source.replace(/^\./, '');
        const to = target.replace(/^\./, '');
        mappings.push({ from, to });
        dataFlow.push({ input: from, transform: `Set ${from} -> ${to}`, output: to });
      }

      if ((actionType === 'Apply Data Transform' || actionType === 'Page-New-Transform') && target) {
        dependencies.push({
          type: 'data_transform',
          target,
          targetClass: className,
          context: `Applies data transform "${target}"`,
        });
        sideEffects.push({
          type: 'page_update',
          target: target,
          detail: `Applies data transform "${target}"`,
        });
      }

      const when = act.pyWhenCondition as string;
      if (when) {
        conditions.push({
          field: when,
          operator: 'WHEN',
          value: true,
          description: `Conditionally applied when "${when}"`,
        });
      }
    }

    const mappingDesc = mappings.map(m => `maps "${m.from}" to "${m.to}"`).join('; ');
    const summary = mappingDesc
      ? `This data transform "${label}" applies ${actions.length} action(s): ${mappingDesc}.`
      : `This data transform "${label}" applies ${actions.length} action(s).`;

    return {
      ruleType: 'Rule-Obj-Model',
      name,
      className,
      summary,
      intent: `Transform data by applying ${actions.length} action(s)`,
      sideEffects,
      dependencies,
      conditions,
      dataFlow,
      propertyMappings: mappings,
    };
  }

  analyzeFlow(json: Record<string, unknown>): SemanticAnalysis {
    const name = this.extractName(json);
    const className = (json.pyClassName as string) || '';
    const label = (json.pyLabel as string) || name;
    const shapes = Array.isArray(json.pyShapes) ? json.pyShapes : Array.isArray(json.shapes) ? json.shapes : [];
    const shapeTypes: string[] = [];
    const dependencies: SemanticDep[] = [];
    const conditions: ConditionSummary[] = [];
    const sideEffects: SideEffect[] = [];
    const dataFlow: DataFlowEntry[] = [];

    for (const s of shapes) {
      const shape = s as Record<string, unknown>;
      const shapeType = (shape.pyShapeType as string) || 'Unknown';
      shapeTypes.push(shapeType);

      if (shape.pyFlowActionName) {
        dependencies.push({
          type: 'flow_action',
          target: shape.pyFlowActionName as string,
          targetClass: className,
          context: `Flow action "${shape.pyFlowActionName}"`,
        });
      }

      if (shape.pyWhenCondition) {
        conditions.push({
          field: shape.pyWhenCondition as string,
          operator: 'WHEN',
          value: true,
          description: `Branches on "${shape.pyWhenCondition}"`,
        });
      }

      if (shape.pyClassName && shape.pyClassName !== className) {
        dataFlow.push({
          input: '',
          transform: `References class ${shape.pyClassName}`,
          output: shape.pyClassName as string,
        });
      }
    }

    const startIdx = shapeTypes.indexOf('Start');
    const endIdx = shapeTypes.lastIndexOf('End');
    const route = startIdx >= 0 && endIdx >= 0 && endIdx > startIdx
      ? `starts at "${shapes[startIdx] && (shapes[startIdx] as Record<string, unknown>).pyName || 'Start'}", routes through ${shapeTypes.length - 2} shape(s), ends at "${shapes[endIdx] && (shapes[endIdx] as Record<string, unknown>).pyName || 'End'}"`
      : `contains ${shapeTypes.length} shape(s)`;

    const summary = `This flow "${label}" ${route}.`;
    return {
      ruleType: 'Rule-Obj-Flow',
      name,
      className,
      summary,
      intent: `Orchestrate ${shapeTypes.length} step(s) through a business process`,
      sideEffects,
      dependencies,
      conditions,
      dataFlow,
      shapeTypes,
    };
  }

  analyzeDecision(json: Record<string, unknown>): SemanticAnalysis {
    const name = this.extractName(json);
    const className = (json.pyClassName as string) || '';
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Declare-DecisionTable';
    const label = (json.pyLabel as string) || name;
    const rows = Array.isArray(json.pyDecisionTableRows) ? json.pyDecisionTableRows : Array.isArray(json.pyRows) ? json.pyRows : [];
    const conditions: ConditionSummary[] = [];
    const dependencies: SemanticDep[] = [];
    const dataFlow: DataFlowEntry[] = [];
    const propertyEvaluated = (json.pyPropertyEvaluated as string) || '';

    for (const r of rows) {
      const row = r as Record<string, unknown>;
      const condText = (row.pyCondition as string) || '';
      const resultText = (row.pyResult as string) || '';

      if (condText) {
        const parts = condText.split(/\s+/);
        conditions.push({
          field: parts[0] || condText,
          operator: parts[1] || '?',
          value: parts.slice(2).join(' ') || '',
          description: condText,
        });
      }

      if (propertyEvaluated) {
        dataFlow.push({
          input: propertyEvaluated,
          transform: `Decision evaluates "${condText}"`,
          output: resultText,
        });
      }
    }

    const returnActions = json.pyReturnActions;
    if (Array.isArray(returnActions)) {
      for (const ra of returnActions) {
        const ract = ra as Record<string, unknown>;
        if (ract.pyTransformName) {
          dependencies.push({
            type: 'data_transform',
            target: ract.pyTransformName as string,
            targetClass: className,
            context: `Decision triggers transform "${ract.pyTransformName}"`,
          });
        }
      }
    }

    const summary = conditions.length > 0
      ? `This ${pxObjClass} "${label}" evaluates ${propertyEvaluated || 'properties'} across ${rows.length} row(s) and returns a matched result.`
      : `This ${pxObjClass} "${label}" has ${rows.length} row(s).`;

    return {
      ruleType: pxObjClass,
      name,
      className,
      summary,
      intent: `Evaluate ${rows.length} condition row(s) to determine output value`,
      sideEffects: [],
      dependencies,
      conditions,
      dataFlow,
      decisionRows: rows.length,
      propertyEvaluated,
    };
  }

  analyzeSection(json: Record<string, unknown>): SemanticAnalysis {
    const name = this.extractName(json);
    const className = (json.pyClassName as string) || '';
    const label = (json.pyLabel as string) || name;
    const fields: string[] = [];
    const layouts: string[] = [];
    const dependencies: SemanticDep[] = [];

    const seenFields = new Set<string>();
    const extractFields = (obj: Record<string, unknown>, prefix: string): void => {
      for (const [key, val] of Object.entries(obj)) {
        if (key === 'pyPropertyName' && typeof val === 'string' && val && !seenFields.has(val)) {
          seenFields.add(val);
          fields.push(val);
        }
        if (key === 'pyLayoutType' && typeof val === 'string' && val) {
          layouts.push(val);
        }
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'object' && item !== null) {
              extractFields(item as Record<string, unknown>, prefix);
            }
          }
        }
      }
    };

    extractFields(json, '');

    const layoutTypes = layouts.length > 0 ? [...new Set(layouts)] : ['dynamic'];
    const summary = fields.length > 0
      ? `This section "${label}" renders ${fields.length} field(s) (${fields.join(', ')}) in ${layoutTypes.join(', ')} layout(s).`
      : `This section "${label}" renders content in ${layoutTypes.join(', ')} layout(s).`;

    return {
      ruleType: 'Rule-Obj-Section',
      name,
      className,
      summary,
      intent: `Render ${fields.length} field(s) in ${layoutTypes.join(', ')} layout(s)`,
      sideEffects: [],
      dependencies,
      conditions: [],
      dataFlow: [],
      renderedFields: fields,
      layoutTypes,
    };
  }

  analyzeConnect(json: Record<string, unknown>): SemanticAnalysis {
    const name = this.extractName(json);
    const className = (json.pyClassName as string) || '';
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Connect-REST';
    const label = (json.pyLabel as string) || name;
    const baseUrl = (json.pyBaseURL as string) || '';
    const resourcePath = (json.pyResourcePath as string) || '';
    const httpMethod = (json.pyHTTPMethod as string) || 'GET';
    const reqClass = (json.pyRequestClass as string) || '';
    const respClass = (json.pyResponseClass as string) || '';
    const authType = (json.pyAuthenticationType as string) || '';
    const sideEffects: SideEffect[] = [];
    const dependencies: SemanticDep[] = [];
    const dataFlow: DataFlowEntry[] = [];

    const url = (baseUrl || '') + (resourcePath || '');
    sideEffects.push({
      type: 'api_call',
      target: url || `${pxObjClass}:${name}`,
      detail: `Calls ${httpMethod} ${url || pxObjClass}`,
    });

    if (reqClass) {
      dataFlow.push({ input: reqClass, transform: `Serialized to ${httpMethod} request`, output: url || 'endpoint' });
    }
    if (respClass) {
      dataFlow.push({ input: url || 'endpoint', transform: `Deserialized from ${httpMethod} response`, output: respClass });
    }

    if (authType) {
      dependencies.push({
        type: 'auth',
        target: authType,
        targetClass: className,
        context: `Uses ${authType} authentication`,
      });
    }

    const summary = url
      ? `This ${pxObjClass} "${label}" calls ${httpMethod} ${url} with ${authType || 'no'} authentication.`
      : `This ${pxObjClass} "${label}" defines a connector endpoint.`;

    return {
      ruleType: pxObjClass,
      name,
      className,
      summary,
      intent: `Call ${httpMethod} ${url || 'external endpoint'} via ${pxObjClass}`,
      sideEffects,
      dependencies,
      conditions: [],
      dataFlow,
      endpointUrl: url,
      httpMethod,
      authType,
    };
  }

  analyzeDeclare(json: Record<string, unknown>): SemanticAnalysis {
    const name = this.extractName(json);
    const className = (json.pyClassName as string) || '';
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Declare-Expressions';
    const label = (json.pyLabel as string) || name;
    const targetProp = (json.pyTargetProperty as string) || (json.pyPropertyName as string) || '';
    const expression = (json.pyExpression as string) || '';
    const dependencies: SemanticDep[] = [];
    const dataFlow: DataFlowEntry[] = [];
    const conditions: ConditionSummary[] = [];
    const sideEffects: SideEffect[] = [];

    if (expression) {
      const inputs = this.extractPropertyRefs(expression);
      for (const input of inputs) {
        dataFlow.push({ input, transform: expression, output: targetProp || name });
      }
      dataFlow.push({ input: inputs.join(', ') || 'unknown', transform: expression, output: targetProp || name });
    }

    const when = json.pyWhenCondition as string;
    if (when) {
      conditions.push({
        field: when,
        operator: 'WHEN',
        value: true,
        description: `Applies when "${when}"`,
      });
    }

    const summary = targetProp && expression
      ? `This ${pxObjClass} "${label}" recalculates "${targetProp}" when dependencies change using expression: "${expression}".`
      : `This ${pxObjClass} "${label}" defines a declarative rule.`;

    return {
      ruleType: pxObjClass,
      name,
      className,
      summary,
      intent: targetProp ? `Recalculate ${targetProp} from ${expression || 'expression'}` : `Define declarative rule`,
      sideEffects,
      dependencies,
      conditions,
      dataFlow,
      targetProperty: targetProp,
      expression,
    };
  }

  analyzeGeneric(json: Record<string, unknown>, classDef: PegaClassDefinition): SemanticAnalysis {
    const name = this.extractName(json);
    const pxObjClass = classDef.pxObjClass || (json.pxObjClass as string) || 'Unknown';
    const description = classDef.description || '';
    const props: string[] = Object.keys(json).filter(k => k.startsWith('py') || k.startsWith('px'));
    const sideEffects: SideEffect[] = [];
    const dependencies: SemanticDep[] = [];
    const dataFlow: DataFlowEntry[] = [];

    for (const prop of classDef.properties) {
      if (prop.isReference && json[prop.name]) {
        dependencies.push({
          type: 'reference',
          target: String(json[prop.name]),
          targetClass: '',
          context: `References "${String(json[prop.name])}" via ${prop.name}`,
        });
      }
    }

    const summary = description
      ? `This ${pxObjClass} "${name}": ${description}. Has ${props.length} relevant propert(ies).`
      : `This ${pxObjClass} "${name}" has ${props.length} relevant propert(ies).`;

    return {
      ruleType: pxObjClass,
      name,
      summary,
      intent: `Configure a ${pxObjClass} with ${props.length} propert(ies)`,
      sideEffects,
      dependencies,
      conditions: [],
      dataFlow,
    };
  }

  private extractName(json: Record<string, unknown>): string {
    return (json.pyRuleName as string)
      || (json.pyActivityName as string)
      || (json.pyModelName as string)
      || (json.pyFlowName as string)
      || (json.pyLabel as string)
      || '';
  }

  private extractPropertyRefs(expr: string): string[] {
    const refs: string[] = [];
    const regex = /\.(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(expr)) !== null) {
      const prop = match[1];
      if (!prop.startsWith('py') && !prop.startsWith('px') && !refs.includes(prop)) {
        refs.push(prop);
      }
    }
    return refs;
  }
}
