/**
 * SA4E-87 — Edge extractors for Pega rule relationships.
 * Each extractor handles a specific rule type and returns typed edges
 * for insertion into the KB Graph.
 */

/** Represents a graph edge extracted from a Pega rule JSON. */
export interface ExtractedEdge {
  sourceId: string;
  targetId: string;
  label: string;
  weight: number;
}

/** Strategy interface for rule-type-specific edge extraction. */
export interface EdgeExtractor {
  /** Returns true if this extractor handles the given pxObjClass. */
  supports(pxObjClass: string): boolean;
  /** Extract edges from parsed rule JSON. */
  extract(json: Record<string, unknown>): ExtractedEdge[];
}

/** Builds a canonical node ID from class + name. */
function nodeId(ruleType: string, className: string, name: string): string {
  return `${ruleType}::${className}::${name}`;
}

/** Safely reads a string field from JSON. */
function str(json: Record<string, unknown>, key: string): string {
  const val = json[key];
  return typeof val === 'string' ? val.trim() : '';
}

/** Extracts CALLS edges from Flow shapes/connectors → targetActivity. */
export class FlowEdgeExtractor implements EdgeExtractor {
  supports(pxObjClass: string): boolean {
    return pxObjClass === 'Rule-Obj-Flow';
  }

  extract(json: Record<string, unknown>): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];
    const flowClass = str(json, 'pyClassName') || '@baseclass';
    const flowName = str(json, 'pyFlowName') || str(json, 'pyRuleName');
    if (!flowName) return edges;
    const sourceId = nodeId('Flow', flowClass, flowName);

    const shapes = (json.pyShapes || json.shapes) as unknown[];
    if (!Array.isArray(shapes)) return edges;

    for (const sh of shapes) {
      if (!sh || typeof sh !== 'object') continue;
      const shape = sh as Record<string, unknown>;
      const target = str(shape, 'pyActivityName') || str(shape, 'pyFlowActionName');
      if (target) {
        edges.push({ sourceId, targetId: nodeId('Activity', flowClass, target), label: 'CALLS', weight: 0.8 });
      }
    }
    return edges;
  }
}

/** Extracts CALLS and USES edges from Activity steps. */
export class ActivityEdgeExtractor implements EdgeExtractor {
  supports(pxObjClass: string): boolean {
    return pxObjClass === 'Rule-Obj-Activity';
  }

  extract(json: Record<string, unknown>): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];
    const cls = str(json, 'pyClassName') || '@baseclass';
    const name = str(json, 'pyActivityName') || str(json, 'pyRuleName');
    if (!name) return edges;
    const sourceId = nodeId('Activity', cls, name);

    const steps = (json.steps || json.pySteps) as unknown[];
    if (!Array.isArray(steps)) return edges;

    for (const s of steps) {
      if (!s || typeof s !== 'object') continue;
      const step = s as Record<string, unknown>;
      this.extractStepEdges(step, sourceId, cls, edges);
    }
    return edges;
  }

  private extractStepEdges(
    step: Record<string, unknown>, sourceId: string, cls: string, edges: ExtractedEdge[],
  ): void {
    const method = str(step, 'pyMethod');
    const params = str(step, 'pyMethodParameters');
    if ((method === 'Call' || method === 'Branch') && params) {
      const actName = params.includes('.') ? params.split('.').pop()! : params;
      edges.push({ sourceId, targetId: nodeId('Activity', cls, actName), label: 'CALLS', weight: 0.8 });
    }
    // Property references: .propName pattern
    if (method === 'Property-Set' && params.startsWith('.')) {
      const prop = params.substring(1);
      edges.push({ sourceId, targetId: nodeId('Property', cls, prop), label: 'USES', weight: 0.5 });
    }
  }
}

/** Extracts INHERITS edge from class parentClass field. */
export class ClassEdgeExtractor implements EdgeExtractor {
  supports(pxObjClass: string): boolean {
    return pxObjClass === 'Rule-Obj-Class';
  }

  extract(json: Record<string, unknown>): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];
    const className = str(json, 'pyClassName') || str(json, 'pyRuleName');
    if (!className) return edges;
    const sourceId = nodeId('Class', '@baseclass', className);

    const parent = str(json, 'pySuperClass') || str(json, 'pyDerivesFrom') || str(json, 'pyPatternParent');
    if (parent && parent !== '@baseclass') {
      edges.push({ sourceId, targetId: nodeId('Class', '@baseclass', parent), label: 'INHERITS', weight: 0.9 });
    }
    return edges;
  }
}

/** Extracts BELONGS_TO edge for any rule with appliesTo/pyClassName. */
export class BelongsToExtractor implements EdgeExtractor {
  supports(_pxObjClass: string): boolean {
    // Applies to all rule types that reference a class
    return true;
  }

  extract(json: Record<string, unknown>): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];
    const pxObjClass = str(json, 'pxObjClass');
    const cls = str(json, 'pyClassName') || str(json, 'appliesTo');
    const name = str(json, 'pyRuleName') || str(json, 'pyActivityName') || str(json, 'pyFlowName');
    if (!cls || cls === '@baseclass' || !name || !pxObjClass) return edges;

    const ruleType = pxObjClass.replace('Rule-Obj-', '');
    const sourceId = nodeId(ruleType, cls, name);
    edges.push({ sourceId, targetId: nodeId('Class', '@baseclass', cls), label: 'BELONGS_TO', weight: 0.6 });
    return edges;
  }
}

/** Extracts READS/WRITES edges from Data Transform (Rule-Obj-Model) actions. */
export class DataTransformEdgeExtractor implements EdgeExtractor {
  supports(pxObjClass: string): boolean {
    return pxObjClass === 'Rule-Obj-Model';
  }

  extract(json: Record<string, unknown>): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];
    const cls = str(json, 'pyClassName') || '@baseclass';
    const name = str(json, 'pyModelName') || str(json, 'pyTransformName') || str(json, 'pyRuleName');
    if (!name) return edges;
    const sourceId = nodeId('DataTransform', cls, name);

    const actions = json.pyActions as unknown[];
    if (!Array.isArray(actions)) return edges;

    for (const a of actions) {
      if (!a || typeof a !== 'object') continue;
      const act = a as Record<string, unknown>;
      this.extractActionEdges(act, sourceId, cls, edges);
    }
    return edges;
  }

  private extractActionEdges(
    act: Record<string, unknown>, sourceId: string, cls: string, edges: ExtractedEdge[],
  ): void {
    const target = str(act, 'pyTarget');
    const source = str(act, 'pySource');
    if (target && target.startsWith('.')) {
      edges.push({ sourceId, targetId: nodeId('Property', cls, target.substring(1)), label: 'WRITES', weight: 0.7 });
    }
    if (source && source.startsWith('.')) {
      edges.push({ sourceId, targetId: nodeId('Property', cls, source.substring(1)), label: 'READS', weight: 0.5 });
    }
  }
}

/** Extracts EVALUATES edges from Decision Table condition columns. */
export class DecisionTableEdgeExtractor implements EdgeExtractor {
  supports(pxObjClass: string): boolean {
    return pxObjClass === 'Rule-Decision-Table';
  }

  extract(json: Record<string, unknown>): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];
    const cls = str(json, 'pyClassName') || '@baseclass';
    const name = str(json, 'pyRuleName') || str(json, 'pyTableName');
    if (!name) return edges;
    const sourceId = nodeId('DecisionTable', cls, name);

    const conditions = (json.pyConditions || json.conditions) as unknown[];
    if (!Array.isArray(conditions)) return edges;

    for (const c of conditions) {
      if (!c || typeof c !== 'object') continue;
      const cond = c as Record<string, unknown>;
      const prop = str(cond, 'pyProperty') || str(cond, 'pyColumnProperty');
      if (prop && prop.startsWith('.')) {
        edges.push({ sourceId, targetId: nodeId('Property', cls, prop.substring(1)), label: 'EVALUATES', weight: 0.6 });
      }
    }
    return edges;
  }
}

/** Registry of all edge extractors — Strategy pattern. */
export const ALL_EXTRACTORS: EdgeExtractor[] = [
  new FlowEdgeExtractor(),
  new ActivityEdgeExtractor(),
  new ClassEdgeExtractor(),
  new DataTransformEdgeExtractor(),
  new DecisionTableEdgeExtractor(),
  // BelongsTo is generic — applied last to all rules
  new BelongsToExtractor(),
];
