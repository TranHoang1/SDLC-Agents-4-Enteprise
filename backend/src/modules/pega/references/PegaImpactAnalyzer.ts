import type { DependencyGraph, DependencyNode, DependencyEdge } from './PegaReferenceExtractor.js';
import { PegaReferenceExtractor } from './PegaReferenceExtractor.js';

export interface ImpactAnalysis {
  ruleName: string;
  ruleType: string;
  directDependents: string[];
  indirectDependents: string[];
  impactScope: 'local' | 'module' | 'crossModule' | 'system';
  risk: 'low' | 'medium' | 'high';
  suggestedTests: string[];
}

export class PegaImpactAnalyzer {
  private extractor: PegaReferenceExtractor;

  constructor(extractor: PegaReferenceExtractor) {
    this.extractor = extractor;
  }

  public analyzeChange(ruleName: string, graph: DependencyGraph): ImpactAnalysis {
    const targetNodes = graph.nodes.filter(n => n.name === ruleName);
    if (targetNodes.length === 0) {
      return {
        ruleName,
        ruleType: 'Unknown',
        directDependents: [],
        indirectDependents: [],
        impactScope: 'local',
        risk: 'low',
        suggestedTests: [],
      };
    }

    const directDependents: string[] = [];
    const allDependents: string[] = [];
    const visited = new Set<string>();

    // Collect direct dependents
    for (const target of targetNodes) {
      const direct = this.extractor.getDependents(target.name, graph);
      for (const d of direct) {
        if (!directDependents.includes(d)) {
          directDependents.push(d);
        }
      }

      // Collect all transitives
      const all = this.extractor.getAllDependents(target.fqn, graph);
      for (const a of all) {
        if (!allDependents.includes(a)) {
          allDependents.push(a);
        }
      }
    }

    const indirectDependents = allDependents.filter(d => !directDependents.includes(d));

    // Determine impact scope
    const impactScope = this.determineScope(targetNodes, graph, allDependents);

    // Determine risk level
    const risk = this.determineRisk(targetNodes, allDependents, impactScope);

    // Generate test suggestions
    const suggestedTests = this.suggestTests(
      {
        ruleName,
        ruleType: targetNodes[0].type,
        directDependents,
        indirectDependents,
        impactScope,
        risk,
        suggestedTests: [],
      },
      graph.nodes.map(n => n.name),
    );

    return {
      ruleName,
      ruleType: targetNodes[0].type,
      directDependents,
      indirectDependents,
      impactScope,
      risk,
      suggestedTests,
    };
  }

  public analyzeBatch(changes: string[], graph: DependencyGraph): Map<string, ImpactAnalysis> {
    const results = new Map<string, ImpactAnalysis>();
    for (const ruleName of changes) {
      results.set(ruleName, this.analyzeChange(ruleName, graph));
    }
    return results;
  }

  public suggestTests(analysis: ImpactAnalysis, allRules: string[]): string[] {
    const tests: string[] = [];

    if (analysis.risk === 'high') {
      tests.push(`Full regression for all rules affected by ${analysis.ruleName}`);
      tests.push(`Integration test: ${analysis.ruleName} interactions`);
    }

    if (analysis.directDependents.length > 0) {
      tests.push(`Unit test: ${analysis.ruleName} direct dependents (${analysis.directDependents.slice(0, 5).join(', ')})`);
    }

    if (analysis.indirectDependents.length > 0) {
      tests.push(`Integration test: ${analysis.ruleName} transitive paths`);
    }

    if (analysis.impactScope === 'crossModule' || analysis.impactScope === 'system') {
      tests.push(`E2E test: flows involving ${analysis.ruleName}`);
    }

    // Specific test patterns based on rule type
    const ruleType = analysis.ruleType;
    if (ruleType === 'Rule-Obj-Activity') {
      tests.push(`Activity test: ${analysis.ruleName} step execution`);
    } else if (ruleType === 'Rule-Obj-Model') {
      tests.push(`DataTransform test: ${analysis.ruleName} mapping results`);
    } else if (ruleType === 'Rule-Obj-When') {
      tests.push(`When condition test: ${analysis.ruleName} evaluates correctly`);
    } else if (ruleType.startsWith('Rule-Connect-')) {
      tests.push(`Connect test: ${analysis.ruleName} endpoint reachable`);
    } else if (ruleType.startsWith('Rule-Decision-')) {
      tests.push(`Decision test: ${analysis.ruleName} strategy outcomes`);
    }

    return tests;
  }

  public toDot(graph: DependencyGraph): string {
    const lines: string[] = [];
    lines.push('digraph PegaDependencies {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box, style=rounded, fontname="Courier New"];');
    lines.push('  edge [fontname="Courier New", fontsize=10];');
    lines.push('');

    // Node declarations with labels
    for (const node of graph.nodes) {
      const safeId = this.dotId(node.fqn);
      const label = `${node.name}\\n${node.type}`;
      lines.push(`  ${safeId} [label="${label}"];`);
    }

    lines.push('');

    // Edge declarations
    for (const edge of graph.edges) {
      const sourceId = this.dotId(edge.source);
      const targetId = this.dotId(edge.target);
      const style = edge.optional ? ' [style=dashed]' : '';
      const label = edge.relation !== 'references' ? ` [label="${edge.relation}"]` : '';
      lines.push(`  ${sourceId} -> ${targetId}${style || label ? ` ${(style + label).trim()}` : ''};`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  private determineScope(
    targetNodes: DependencyNode[],
    graph: DependencyGraph,
    allDependents: string[],
  ): ImpactAnalysis['impactScope'] {
    if (allDependents.length === 0) return 'local';

    const targetTypes = new Set(targetNodes.map(n => n.type));
    const dependentTypes = new Set<string>();

    for (const depName of allDependents) {
      const depNodes = graph.nodes.filter(n => n.name === depName);
      for (const dn of depNodes) {
        dependentTypes.add(dn.type);
      }
    }

    // Check if dependent types span multiple major categories
    const categories = new Set<string>();
    const allTypes = new Set([...targetTypes, ...dependentTypes]);

    for (const t of allTypes) {
      const category = t.split('-').slice(0, 3).join('-');
      categories.add(category);
    }

    if (categories.size >= 4) return 'system';
    if (categories.size >= 2) return 'crossModule';
    if (allDependents.length > 5) return 'module';
    return 'local';
  }

  private determineRisk(
    targetNodes: DependencyNode[],
    allDependents: string[],
    scope: ImpactAnalysis['impactScope'],
  ): ImpactAnalysis['risk'] {
    // Base risk on scope + number of dependents
    if (scope === 'system') return 'high';
    if (scope === 'crossModule' && allDependents.length > 10) return 'high';
    if (scope === 'crossModule') return 'medium';
    if (scope === 'module' && allDependents.length > 20) return 'high';
    if (scope === 'module') return 'medium';

    // Check if any targets are base classes or fundamental rules
    for (const node of targetNodes) {
      if (node.type === 'Rule-Obj-Class' && node.name !== '@baseclass') return 'medium';
    }

    return 'low';
  }

  private dotId(fqn: string): string {
    return `"${fqn.replace(/[^a-zA-Z0-9_:@.-]/g, '_')}"`;
  }
}
