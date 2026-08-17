import { PegaSchemaInferrer } from '../inference/PegaSchemaInferrer.js';
import { PegaFieldDocumentor } from '../inference/PegaFieldDocumentor.js';
import { PegaSemanticAnalyzer } from '../semantic/PegaSemanticAnalyzer.js';
import { PegaRuleSimulator } from '../semantic/PegaRuleSimulator.js';
import { PegaReferenceExtractor } from '../references/PegaReferenceExtractor.js';
import { PegaMetaModelRegistry } from '../metamodel/PegaMetaModelRegistry.js';
import { PegaMetaModelCompiler } from '../metamodel/PegaMetaModelCompiler.js';
import type { PegaClassDefinition } from '../metamodel/PegaClassDefinition.js';
import type { SideEffect, DataFlowEntry, ConditionSummary } from '../semantic/types.js';
import type { ResolvedDependency } from '../references/PegaReferenceExtractor.js';
import type { SimulationResult, SimulationTrace } from '../semantic/PegaRuleSimulator.js';

export interface PegaRuleUnderstanding {
  pxObjClass: string;
  name: string;
  className: string;
  fqn: string;

  schema: {
    classDefinition: PegaClassDefinition;
    fieldDocs: string;
    inferred: boolean;
  };

  semantics: {
    summary: string;
    intent: string;
    sideEffects: SideEffect[];
    dataFlow: DataFlowEntry[];
    conditions: ConditionSummary[];
  };

  dependencies: ResolvedDependency[];
  dependencyGraph: string;

  simulation: {
    input: Record<string, Record<string, unknown>> | null;
    result: SimulationResult | null;
    trace: SimulationTrace[];
  } | null;

  promptContext: string;
}

export class PegaRuleUnderstandingService {
  constructor(
    private inferrer: PegaSchemaInferrer,
    private documentor: PegaFieldDocumentor,
    private analyzer: PegaSemanticAnalyzer,
    private simulator: PegaRuleSimulator,
    private extractor: PegaReferenceExtractor,
    private registry: PegaMetaModelRegistry,
    private compiler: PegaMetaModelCompiler,
  ) {}

  async understand(json: Record<string, unknown>, options?: {
    simulate?: boolean;
    simulateInput?: Record<string, Record<string, unknown>>;
  }): Promise<PegaRuleUnderstanding> {
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Obj-Activity';
    const className = (json.pyClassName as string) || '@baseclass';
    const name = this.extractRuleName(json);
    const fqn = `${pxObjClass}:${className}:${name}`;

    const wasKnown = this.registry.isKnownClass(pxObjClass);
    const classDef = this.inferrer.ensureSchema(pxObjClass, json, this.registry);
    const inferred = !wasKnown;

    const fieldDocs = this.documentor.generatePromptContext(pxObjClass, json, this.registry);
    const analysis = this.analyzer.analyze(json);
    const deps = this.extractor.extractFromRule(json);
    const dependencyGraph = this.buildDependencyGraphText(deps);

    let simulation: PegaRuleUnderstanding['simulation'] = null;
    if (options?.simulate) {
      const simInput = options.simulateInput || null;
      let simResult: SimulationResult | null;
      let simTrace: SimulationTrace[];

      try {
        simResult = await this.simulator.simulate({
          pxObjClass,
          json,
          inputClipboard: options.simulateInput,
          options: { collectTrace: true },
        });
        simTrace = simResult.trace;
      } catch {
        simResult = null;
        simTrace = [];
      }

      simulation = {
        input: simInput,
        result: simResult,
        trace: simTrace,
      };
    }

    const understanding: PegaRuleUnderstanding = {
      pxObjClass,
      name,
      className,
      fqn,
      schema: {
        classDefinition: classDef,
        fieldDocs,
        inferred,
      },
      semantics: {
        summary: analysis.summary,
        intent: analysis.intent,
        sideEffects: analysis.sideEffects,
        dataFlow: analysis.dataFlow,
        conditions: analysis.conditions,
      },
      dependencies: deps,
      dependencyGraph,
      simulation,
      promptContext: '',
    };

    understanding.promptContext = this.toPromptContext(understanding);

    return understanding;
  }

  toPromptContext(understanding: PegaRuleUnderstanding): string {
    const lines: string[] = [];
    const W = 55;

    const topBorder = `╔${'═'.repeat(W)}╗`;
    const bottomBorder = `╚${'═'.repeat(W)}╝`;

    lines.push(topBorder);
    lines.push(`║  Rule Understanding: ${understanding.name.padEnd(W - 26)}║`);
    lines.push(`║  Type: ${understanding.pxObjClass.padEnd(W - 12)}║`);
    lines.push(`║  Class: ${understanding.className.padEnd(W - 13)}║`);
    lines.push(bottomBorder);
    lines.push('');

    lines.push(`── Schema ${'─'.repeat(W - 10)}──`);
    lines.push(`  Inferred: ${understanding.schema.inferred ? 'yes — detected from JSON' : 'no — loaded from known schema'}`);
    const docLines = understanding.schema.fieldDocs.split('\n');
    for (let i = 0; i < docLines.length; i++) {
      lines.push(`  ${docLines[i]}`);
    }
    lines.push('');

    lines.push(`── Semantic Analysis ${'─'.repeat(W - 22)}──`);
    lines.push(`  Summary: ${understanding.semantics.summary}`);
    lines.push(`  Intent: ${understanding.semantics.intent}`);

    if (understanding.semantics.sideEffects.length > 0) {
      lines.push('  Side Effects:');
      for (const se of understanding.semantics.sideEffects) {
        lines.push(`    • ${se.type}: ${se.detail}`);
      }
    }

    if (understanding.semantics.dataFlow.length > 0) {
      lines.push('  Data Flow:');
      for (const df of understanding.semantics.dataFlow) {
        if (df.input) {
          lines.push(`    ${df.input} > ${df.transform} > ${df.output}`);
        } else {
          lines.push(`    ${df.transform} > ${df.output}`);
        }
      }
    }

    if (understanding.semantics.conditions.length > 0) {
      lines.push('  Conditions:');
      for (const cond of understanding.semantics.conditions) {
        lines.push(`    WHEN ${cond.field} ${cond.operator} ${cond.value} — ${cond.description}`);
      }
    }
    lines.push('');

    lines.push(`── Dependencies ${'─'.repeat(W - 16)}──`);
    if (understanding.dependencies.length === 0) {
      lines.push('  (none)');
    } else {
      for (const dep of understanding.dependencies) {
        const opt = dep.optional ? ' (optional)' : '';
        lines.push(`  → ${dep.type}: ${dep.name} (${dep.relation})${opt}`);
      }
    }
    if (understanding.dependencyGraph) {
      lines.push(`  Graph: ${understanding.dependencyGraph}`);
    }
    lines.push('');

    if (understanding.simulation) {
      lines.push(`── Simulation ${'─'.repeat(W - 14)}──`);
      if (understanding.simulation.input) {
        lines.push(`  Input: ${JSON.stringify(understanding.simulation.input)}`);
      }
      if (understanding.simulation.result) {
        const r = understanding.simulation.result;
        lines.push(`  Result: ${r.success ? '✓ Success' : '✗ Failed'} (${r.executionTimeMs}ms)`);
        if (r.errors.length > 0) {
          for (const err of r.errors) {
            lines.push(`    Error: ${err}`);
          }
        }
      }
      if (understanding.simulation.trace.length > 0) {
        lines.push('  Trace:');
        for (const t of understanding.simulation.trace) {
          lines.push(`    Step ${t.step}: ${t.action} — ${t.detail}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private extractRuleName(json: Record<string, unknown>): string {
    return (json.pyRuleName as string)
      || (json.pyActivityName as string)
      || (json.pyModelName as string)
      || (json.pyTransformName as string)
      || (json.pyFlowName as string)
      || (json.pyLabel as string)
      || 'Unnamed';
  }

  private buildDependencyGraphText(deps: ResolvedDependency[]): string {
    if (deps.length === 0) return '';
    const entries = deps.map(d => `${d.type}:${d.name}`);
    return entries.join('; ');
  }
}
