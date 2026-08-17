import { PegaExpressionEvaluator } from '../expression/PegaExpressionEvaluator.js';
import { PegaClipboardContext } from '../expression/PegaClipboardContext.js';
import { PegaWorkflowEngine } from '../workflow/PegaWorkflowEngine.js';
import { PegaFlowGraph, type ShapeNode, type Connector } from '../workflow/PegaFlowGraph.js';
import { PegaDecisionTableEvaluator } from '../decision/PegaDecisionTableEvaluator.js';
import type { PegaDecisionTableRow } from '../decision/PegaEvaluationResult.js';

export interface SimulationOptions {
  maxSteps?: number;
  collectTrace?: boolean;
  timeoutMs?: number;
}

export interface SimulationTrace {
  step: number;
  action: string;
  detail: string;
  timestamp: number;
}

export interface SimulationRequest {
  pxObjClass: string;
  json: Record<string, unknown>;
  inputClipboard?: Record<string, Record<string, unknown>>;
  options?: SimulationOptions;
}

export interface SimulationResult {
  success: boolean;
  outputClipboard?: Record<string, Record<string, unknown>>;
  trace: SimulationTrace[];
  errors: string[];
  executionTimeMs: number;
}

export class PegaRuleSimulator {
  private expressionEvaluator: PegaExpressionEvaluator;
  private workflowEngine: PegaWorkflowEngine;
  private decisionTableEvaluator: PegaDecisionTableEvaluator;

  constructor() {
    this.expressionEvaluator = new PegaExpressionEvaluator();
    this.workflowEngine = new PegaWorkflowEngine();
    this.decisionTableEvaluator = new PegaDecisionTableEvaluator();
  }

  async simulate(request: SimulationRequest): Promise<SimulationResult> {
    const startTime = Date.now();
    const { pxObjClass, json, inputClipboard, options } = request;
    const clipboard = new PegaClipboardContext(inputClipboard || {}, 'pyWorkPage');

    switch (true) {
      case pxObjClass === 'Rule-Obj-Activity':
        return this.simulateActivity(json, clipboard, options);
      case pxObjClass === 'Rule-Obj-Model':
        return this.simulateDataTransform(json, clipboard, options);
      case pxObjClass === 'Rule-Obj-Flow':
        return this.simulateFlow(json, clipboard, options);
      case pxObjClass === 'Rule-Declare-DecisionTable' || pxObjClass === 'Rule-Declare-DecisionTree':
        return this.simulateDecisionTable(json, clipboard, options);
      default:
        return {
          success: false,
          trace: [{ step: 0, action: 'unsupported', detail: `Simulation not available for rule type: ${pxObjClass}`, timestamp: Date.now() }],
          errors: [`Unsupported rule type: ${pxObjClass}`],
          executionTimeMs: Date.now() - startTime,
        };
    }
  }

  simulateActivity(
    json: Record<string, unknown>,
    context: PegaClipboardContext,
    options?: SimulationOptions,
  ): SimulationResult {
    const startTime = Date.now();
    const trace: SimulationTrace[] = [];
    const errors: string[] = [];
    let stepCount = 0;
    const maxSteps = options?.maxSteps ?? 100;

    const name = (json.pyActivityName as string) || (json.pyRuleName as string) || '';
    const steps = Array.isArray(json.steps) ? json.steps : [];

    trace.push({
      step: stepCount++,
      action: 'start',
      detail: `Beginning simulation of activity "${name}" with ${steps.length} step(s)`,
      timestamp: Date.now(),
    });

    for (const s of steps) {
      if (stepCount > maxSteps) {
        errors.push(`Simulation exceeded max steps (${maxSteps})`);
        break;
      }

      const step = s as Record<string, unknown>;
      const method = (step.pyMethod as string) || '';
      const params = (step.pyMethodParameters as string) || '';
      const stepLabel = (step.pyLabel as string) || '';

      const when = step.pyWhenCondition as string;
      if (when) {
        try {
          const whenResult = this.expressionEvaluator.evaluate(when, context, options?.collectTrace);
          if (!whenResult.value.boolean) {
            trace.push({
              step: stepCount++,
              action: 'skip',
              detail: `Step "${stepLabel || method}" skipped (when condition "${when}" evaluated to false)`,
              timestamp: Date.now(),
            });
            continue;
          }
        } catch (err) {
          errors.push(`When condition evaluation error: ${err}`);
          trace.push({
            step: stepCount++,
            action: 'error',
            detail: `When condition "${when}" evaluation failed: ${err}`,
            timestamp: Date.now(),
          });
          continue;
        }
      }

      if (method === 'Call' || method === 'Branch') {
        trace.push({
          step: stepCount++,
          action: 'call',
          detail: `Calling activity ${params} (${stepLabel || 'no label'})`,
          timestamp: Date.now(),
        });
      } else if (method === 'Property-Set' || method === 'Property-Copy') {
        const target = params.replace(/^\./, '');
        trace.push({
          step: stepCount++,
          action: 'set',
          detail: `Setting property "${target}"`,
          timestamp: Date.now(),
        });
      } else if (method === 'Obj-Save' || method === 'Save') {
        trace.push({
          step: stepCount++,
          action: 'db_write',
          detail: `Saving "${params}" to database`,
          timestamp: Date.now(),
        });
      } else if (method === 'Obj-Delete') {
        trace.push({
          step: stepCount++,
          action: 'db_write',
          detail: `Deleting "${params}" from database`,
          timestamp: Date.now(),
        });
      } else if (method === 'Page-New') {
        trace.push({
          step: stepCount++,
          action: 'page_new',
          detail: `Creating new page "${params}"`,
          timestamp: Date.now(),
        });
      } else if (method) {
        trace.push({
          step: stepCount++,
          action: 'execute',
          detail: `Executing step method="${method}" params="${params}"`,
          timestamp: Date.now(),
        });
      } else {
        trace.push({
          step: stepCount++,
          action: 'noop',
          detail: `Step with no method`,
          timestamp: Date.now(),
        });
      }
    }

    trace.push({
      step: stepCount,
      action: 'complete',
      detail: `Activity "${name}" simulation complete (${steps.length} steps processed)`,
      timestamp: Date.now(),
    });

    return {
      success: errors.length === 0,
      trace,
      errors,
      executionTimeMs: Date.now() - startTime,
    };
  }

  simulateDataTransform(
    json: Record<string, unknown>,
    context: PegaClipboardContext,
    options?: SimulationOptions,
  ): SimulationResult {
    const startTime = Date.now();
    const trace: SimulationTrace[] = [];
    const errors: string[] = [];
    let stepCount = 0;

    const name = (json.pyModelName as string) || (json.pyRuleName as string) || '';
    const actions = Array.isArray(json.pyActions) ? json.pyActions : [];

    trace.push({
      step: stepCount++,
      action: 'start',
      detail: `Beginning simulation of data transform "${name}" with ${actions.length} action(s)`,
      timestamp: Date.now(),
    });

    for (const a of actions) {
      const act = a as Record<string, unknown>;
      const actionType = (act.pyActionType as string) || '';
      const target = (act.pyTarget as string) || '';

      const when = act.pyWhenCondition as string;
      if (when) {
        try {
          const whenResult = this.expressionEvaluator.evaluate(when, context, options?.collectTrace);
          if (!whenResult.value.boolean) {
            trace.push({
              step: stepCount++,
              action: 'skip',
              detail: `Action "${actionType}" skipped (when condition "${when}" evaluated to false)`,
              timestamp: Date.now(),
            });
            continue;
          }
        } catch (err) {
          errors.push(`When condition evaluation error in data transform: ${err}`);
          trace.push({
            step: stepCount++,
            action: 'error',
            detail: `When condition "${when}" evaluation failed: ${err}`,
            timestamp: Date.now(),
          });
          continue;
        }
      }

      if (actionType === 'Set') {
        const source = (act.pySource as string) || '';
        trace.push({
          step: stepCount++,
          action: 'set',
          detail: `Mapping "${source}" -> "${target}"`,
          timestamp: Date.now(),
        });
      } else if (actionType === 'Apply Data Transform' || actionType === 'Page-New-Transform') {
        trace.push({
          step: stepCount++,
          action: 'apply_transform',
          detail: `Applying sub-transform "${target}"`,
          timestamp: Date.now(),
        });
      } else {
        trace.push({
          step: stepCount++,
          action: 'execute',
          detail: `Executing action "${actionType}" on target "${target}"`,
          timestamp: Date.now(),
        });
      }
    }

    trace.push({
      step: stepCount,
      action: 'complete',
      detail: `Data transform "${name}" simulation complete`,
      timestamp: Date.now(),
    });

    return {
      success: errors.length === 0,
      trace,
      errors,
      executionTimeMs: Date.now() - startTime,
    };
  }

  simulateFlow(
    json: Record<string, unknown>,
    context: PegaClipboardContext,
    _options?: SimulationOptions,
  ): SimulationResult {
    const startTime = Date.now();
    const trace: SimulationTrace[] = [];
    const errors: string[] = [];
    let stepCount = 0;

    const name = (json.pyFlowName as string) || (json.pyRuleName as string) || '';
    const shapes = Array.isArray(json.pyShapes) ? json.pyShapes : Array.isArray(json.shapes) ? json.shapes : [];

    if (shapes.length === 0) {
      return {
        success: false,
        trace: [{ step: 0, action: 'error', detail: 'Flow has no shapes defined', timestamp: Date.now() }],
        errors: ['Flow has no shapes defined'],
        executionTimeMs: Date.now() - startTime,
      };
    }

    const shapeMap = new Map<string, ShapeNode>();
    const connectors: Connector[] = [];

    for (let i = 0; i < shapes.length; i++) {
      const sh = shapes[i] as Record<string, unknown>;
      const shapeId = (sh.pyName as string) || `shape_${i}`;
      const shapeType = (sh.pyShapeType as string) || 'Unknown';
      const shape: ShapeNode = { id: shapeId, type: shapeType, properties: sh as Record<string, unknown> };
      shapeMap.set(shapeId, shape);

      if (i < shapes.length - 1) {
        const nextShape = shapes[i + 1] as Record<string, unknown>;
        const nextId = (nextShape.pyName as string) || `shape_${i + 1}`;
        connectors.push({
          id: `conn_${i}`,
          fromShapeId: shapeId,
          toShapeId: nextId,
          isDefault: true,
        });
      }
    }

    const graph = new PegaFlowGraph(shapeMap, connectors);
    const wfResult = this.workflowEngine.simulate(graph, context);

    for (const log of wfResult.log) {
      trace.push({
        step: stepCount++,
        action: 'flow_step',
        detail: log,
        timestamp: Date.now(),
      });
    }

    trace.push({
      step: stepCount,
      action: wfResult.completed ? 'complete' : 'incomplete',
      detail: wfResult.completed
        ? `Flow "${name}" reached END after ${wfResult.history.length} shape(s)`
        : `Flow "${name}" did not reach END (stopped at shape ${wfResult.currentNodeId})`,
      timestamp: Date.now(),
    });

    return {
      success: wfResult.completed,
      trace,
      errors,
      executionTimeMs: Date.now() - startTime,
    };
  }

  simulateDecisionTable(
    json: Record<string, unknown>,
    context: PegaClipboardContext,
    _options?: SimulationOptions,
  ): SimulationResult {
    const startTime = Date.now();
    const trace: SimulationTrace[] = [];
    const errors: string[] = [];
    let stepCount = 0;

    const name = (json.pyLabel as string) || (json.pyRuleName as string) || '';
    const rows = Array.isArray(json.pyDecisionTableRows) ? json.pyDecisionTableRows : Array.isArray(json.pyRows) ? json.pyRows : [];

    const dtRows: PegaDecisionTableRow[] = rows.map((r: unknown, i: number) => {
      const row = r as Record<string, unknown>;
      const condText = (row.pyCondition as string) || '';

      const conditions = condText
        ? [this.parseConditionFromString(condText)]
        : [];

      return {
        rowId: `R${i + 1}`,
        priority: i + 1,
        conditions,
        result: row.pyResult ?? null,
      };
    });

    trace.push({
      step: stepCount++,
      action: 'start',
      detail: `Beginning decision table "${name}" evaluation with ${dtRows.length} row(s)`,
      timestamp: Date.now(),
    });

    try {
      const result = this.decisionTableEvaluator.evaluate(dtRows, context, this.expressionEvaluator);

      for (const t of result.tracePath) {
        trace.push({
          step: stepCount++,
          action: 'eval',
          detail: t,
          timestamp: Date.now(),
        });
      }

      trace.push({
        step: stepCount++,
        action: result.status === 'matched' ? 'matched' : 'no_match',
        detail: result.status === 'matched'
          ? `Matched row ${result.matchedRowId} with result: ${JSON.stringify(result.outputValue)}`
          : 'No matching row found',
        timestamp: Date.now(),
      });

      return {
        success: result.status === 'matched' || result.status === 'no_match',
        trace,
        errors,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      errors.push(`Decision table evaluation error: ${err}`);
      trace.push({
        step: stepCount,
        action: 'error',
        detail: `Decision table evaluation failed: ${err}`,
        timestamp: Date.now(),
      });
      return {
        success: false,
        trace,
        errors,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private parseConditionFromString(condText: string): { field: string; operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER' | 'GREATER_EQUALS' | 'LESS' | 'LESS_EQUALS'; value: unknown } {
    const parts = condText.trim().split(/\s+/);
    if (parts.length >= 3) {
      const field = parts[0];
      const opSymbol = parts[1];
      const value = parts.slice(2).join(' ');

      let operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER' | 'GREATER_EQUALS' | 'LESS' | 'LESS_EQUALS' = 'EQUALS';
      switch (opSymbol) {
        case '>': operator = 'GREATER'; break;
        case '<': operator = 'LESS'; break;
        case '>=': operator = 'GREATER_EQUALS'; break;
        case '<=': operator = 'LESS_EQUALS'; break;
        case '!=': case '<>': operator = 'NOT_EQUALS'; break;
        case '=': operator = 'EQUALS'; break;
        default: {
          if (opSymbol.toLowerCase() === 'equals') operator = 'EQUALS';
          break;
        }
      }

      const numericValue = Number(value);
      return { field, operator, value: isNaN(numericValue) ? value : numericValue };
    }

    if (parts.length === 1 && condText.includes(' ')) {
      return { field: condText, operator: 'EQUALS', value: true };
    }

    return { field: condText, operator: 'EQUALS', value: condText };
  }

  evaluateExpression(expression: string, context: PegaClipboardContext): unknown {
    const result = this.expressionEvaluator.evaluate(expression, context);
    return result.value.value;
  }
}
