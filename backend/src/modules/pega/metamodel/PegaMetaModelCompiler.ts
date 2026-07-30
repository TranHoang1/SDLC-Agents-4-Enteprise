/**
 * PegaMetaModelCompiler — Generates IPegaRuleParserStrategy instances
 * from PegaClassDefinition schemas at runtime (dynamic, not code-gen).
 *
 * Each compiled strategy knows its class definition, supports inheritance-based
 * matching, and extracts properties/children/dependencies automatically.
 */

import type { PegaClassDefinition, PegaPropertyDef, PegaChildDef } from './PegaClassDefinition.js';
import type { PegaMetaModelRegistry } from './PegaMetaModelRegistry.js';
import type { IPegaRuleParserStrategy, ParseResult } from '../strategies/IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';
import type { PegaParserRegistry } from '../strategies/PegaParserRegistry.js';

/**
 * Compiled strategy that wraps a PegaClassDefinition and uses the registry
 * for inheritance resolution.
 */
class CompiledPegaRuleParserStrategy implements IPegaRuleParserStrategy {
  constructor(
    private readonly classDef: PegaClassDefinition,
    private readonly compiler: PegaMetaModelCompiler,
    private readonly registry: PegaMetaModelRegistry,
  ) {}

  /**
   * Check whether this strategy supports the given pxObjClass.
   *
   * Matching rules:
   * 1. Exact match on pxObjClass
   * 2. @baseclass supports everything
   * 3. Classes ending with '-' (base categories) support any subclass by prefix
   * 4. Full inheritance check via the registry
   */
  public supports(pxObjClass: string): boolean {
    if (pxObjClass === this.classDef.pxObjClass) return true;
    if (this.classDef.pxObjClass === '@baseclass') return true;

    // Base-category classes ending with '-' support prefix match
    if (this.classDef.pxObjClass.endsWith('-')) {
      if (pxObjClass.startsWith(this.classDef.pxObjClass)) return true;
    }

    // Full inheritance chain check
    return this.compiler.isDerivedFrom(pxObjClass, this.classDef.pxObjClass);
  }

  /**
   * Parse a raw JSON object into a ParseResult.
   * Extracts the symbol (name, class, type), detects references as dependencies,
   * and records all properties per the class definition.
   */
  public parse(json: Record<string, unknown>): ParseResult {
    const pxObjClass = (json.pxObjClass as string) || this.classDef.pxObjClass;
    const className = (json.pyClassName as string) || (json.className as string) || '@baseclass';
    const name = this.extractName(json);
    const fqn = `${pxObjClass}:${className}:${name}`;

    const symbol = {
      fqn,
      name,
      className,
      ruleType: pxObjClass,
      isRule: pxObjClass.startsWith('Rule-'),
      ruleset: (json.pyRuleset as string) || undefined,
      version: (json.pyRulesetVersion as string) || undefined,
      logicSummary: this.buildLogicSummary(json),
    };

    const dependencies = this.extractDependencies(json, className);

    return { symbol, dependencies };
  }

  private extractName(json: Record<string, unknown>): string {
    const candidates = ['pyRuleName', 'pyActivityName', 'pyModelName', 'pyTransformName',
      'pyFlowName', 'pyServiceRuleName', 'pyServiceName', 'pyLabel', 'pyName'];
    for (const key of candidates) {
      const val = json[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return 'Unnamed';
  }

  private extractDependencies(json: Record<string, unknown>, className: string): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    const visited = new Set<string>();

    // 1. Extract from classDef properties marked as isReference
    for (const prop of this.classDef.properties) {
      if (!prop.isReference) continue;
      const val = json[prop.name];
      if (typeof val !== 'string' || !val.trim()) continue;
      const key = `${prop.name}:${val}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const ruleType = this.inferRuleType(prop.name, val, json);
      deps.push({ ruleType, className, ruleName: val.trim() });
    }

    // 2. Detect additional reference fields by naming convention
    //    Fields ending in reference-like suffixes that aren't already captured
    const referenceSuffixes = ['Name', 'Class', 'Profile', 'Transform', 'Condition', 'From', 'Evaluated', 'Trigger', 'Action', 'Target', 'Source', 'Expression'];
    for (const [key, val] of Object.entries(json)) {
      if (typeof val !== 'string' || !val.trim()) continue;
      if (key === 'pxObjClass' || key === 'pyClassName' || key === 'pyRuleName') continue;
      if (key === 'pyRuleset' || key === 'pyRulesetVersion' || key === 'pyRuleSet' || key === 'pyRuleSetVersion') continue;

      const hasRefSuffix = referenceSuffixes.some(s => key.endsWith(s));
      if (!hasRefSuffix) continue;

      // Skip if already captured as isReference property
      if (this.classDef.properties.some(p => p.name === key && p.isReference)) continue;

      const depKey = `${key}:${val}`;
      if (visited.has(depKey)) continue;
      visited.add(depKey);

      const ruleType = this.inferRuleType(key, val, json);
      deps.push({ ruleType, className, ruleName: val.trim() });
    }

    return deps;
  }

  private inferRuleType(fieldName: string, fieldValue: string, _json?: Record<string, unknown>): string {
    // Map known reference fields to rule types
    if (fieldName === 'pyAuthProfile') return 'Rule-Connect-AuthProfile';
    if (fieldName === 'pyRequestDataTransform' || fieldName === 'pyResponseDataTransform') return 'Rule-Obj-Model';
    if (fieldName === 'pyWhenCondition') return 'Rule-Obj-When';
    if (fieldName === 'pyOnChangeTrigger') return 'Rule-Obj-When';
    if (fieldName === 'pyFlowActionName') return 'Rule-Obj-FlowAction';
    if (fieldName === 'pySuperClass' || fieldName === 'pyDerivesFrom' || fieldName === 'pyPatternParent') return 'Rule-Obj-Class';
    if (fieldName === 'pyTransformName') return 'Rule-Obj-Model';
    if (fieldName === 'pyActivityName') return 'Rule-Obj-Activity';
    if (fieldName === 'pyFlowName') return 'Rule-Obj-Flow';
    if (fieldName === 'pyPropertyName') return 'Rule-Obj-Property';
    if (fieldName === 'pyPropertyEvaluated') return 'Rule-Obj-Property';
    if (fieldName === 'pyMethodParameters') return 'Rule-Obj-Activity';

    // Generic detection from value pattern
    if (fieldValue.includes('.') && fieldName.includes('Method')) return 'Rule-Obj-Activity';
    if (fieldName.endsWith('Transform')) return 'Rule-Obj-Model';
    if (fieldName.endsWith('Class')) return 'Rule-Obj-Class';
    if (fieldName.endsWith('Profile')) return 'Rule-Connect-AuthProfile';
    if (fieldName.endsWith('Condition')) return 'Rule-Obj-When';
    if (fieldName.endsWith('From')) return 'Rule-Obj-Class';
    if (fieldName.endsWith('Evaluated')) return 'Rule-Obj-Property';
    if (fieldName.endsWith('Trigger')) return 'Rule-Obj-When';
    if (fieldName.endsWith('Action')) return 'Rule-Obj-FlowAction';
    if (fieldName.endsWith('Target')) return 'Rule-Obj-Model';
    if (fieldName.endsWith('Source')) return 'Rule-Obj-Class';
    if (fieldName.endsWith('Expression')) return 'Rule-Obj-Model';
    if (fieldName.endsWith('Name')) return 'Rule-Obj-Activity';

    return 'Rule-Obj-Activity';
  }

  private buildLogicSummary(json: Record<string, unknown>): string | undefined {
    const name = this.extractName(json);
    const cls = this.classDef;
    const lines: string[] = [];
    lines.push(`${cls.pxObjClass}: ${name}`);

    // Add key fields based on classDef meta
    for (const prop of cls.properties.slice(0, 6)) {
      const val = json[prop.name];
      if (val !== undefined && val !== null && val !== '') {
        lines.push(`  ${prop.name}: ${String(val)}`);
      }
    }

    // Count children
    let childCount = 0;
    for (const child of cls.children) {
      const arr = json[child.name];
      if (Array.isArray(arr)) childCount += arr.length;
    }

    if (childCount > 0) {
      lines.push(`  Children: ${childCount} item(s) across ${cls.children.length} array(s)`);
    }

    return lines.join('\n');
  }
}

export class PegaMetaModelCompiler {
  private registry: PegaMetaModelRegistry;
  private compiled: Map<string, CompiledPegaRuleParserStrategy> = new Map();
  private hierarchyCache: Map<string, Set<string>> = new Map();

  constructor(registry: PegaMetaModelRegistry) {
    this.registry = registry;
  }

  /**
   * Generate a strategy for a single class definition.
   * The strategy will match the exact class and any subclasses.
   */
  public compileStrategy(classDef: PegaClassDefinition): IPegaRuleParserStrategy {
    const existing = this.compiled.get(classDef.pxObjClass);
    if (existing) return existing;

    const strategy = new CompiledPegaRuleParserStrategy(classDef, this, this.registry);
    this.compiled.set(classDef.pxObjClass, strategy);
    return strategy;
  }

  /**
   * Compile ALL registered classes into strategies.
   * Returns strategies ordered from most concrete to most generic
   * so the most specific match is found first.
   */
  public compileAll(): IPegaRuleParserStrategy[] {
    // Build inheritance depth map for ordering
    const depthMap = new Map<string, number>();

    const computeDepth = (pxObjClass: string): number => {
      const cached = depthMap.get(pxObjClass);
      if (cached !== undefined) return cached;
      const def = this.registry.getParser(pxObjClass);
      if (!def || !def.baseClass) {
        depthMap.set(pxObjClass, 0);
        return 0;
      }
      const depth = computeDepth(def.baseClass) + 1;
      depthMap.set(pxObjClass, depth);
      return depth;
    };

    // Get all classes sorted by inheritance depth (deepest first = most specific first)
    const classes = this.registry.getKnownClasses();

    for (const cls of classes) {
      computeDepth(cls);
    }

    // Sort by depth descending so concrete classes compile first
    const sorted = [...classes].sort((a, b) => (depthMap.get(b) || 0) - (depthMap.get(a) || 0));

    const strategies: IPegaRuleParserStrategy[] = [];
    for (const cls of sorted) {
      const def = this.registry.getParser(cls);
      if (def) {
        strategies.push(this.compileStrategy(def));
      }
    }

    return strategies;
  }

  /**
   * Get a compiled strategy for a specific pxObjClass.
   */
  public getStrategy(pxObjClass: string): IPegaRuleParserStrategy | undefined {
    return this.compiled.get(pxObjClass);
  }

  /**
   * Register all compiled strategies into a PegaParserRegistry.
   * More specific strategies are registered before generic ones.
   */
  public registerAll(parserRegistry: PegaParserRegistry): void {
    // Get all compiled strategies sorted by specificity
    const all = this.compileAll();

    // Register generic base classes first (they'll end up last via unshift),
    // concrete classes last (they'll end up first, matching first)
    const sorted = this.sortByInheritanceDepth(all);

    for (const strategy of sorted) {
      parserRegistry.registerStrategy(strategy);
    }
  }

  /**
   * Check if a given pxObjClass derives from a potential base class.
   * Uses the registry for class definition lookup and follows the baseClass chain.
   */
  public isDerivedFrom(pxObjClass: string, potentialBaseClass: string): boolean {
    if (pxObjClass === potentialBaseClass) return true;
    if (potentialBaseClass === '@baseclass') return true;

    // Build cached ancestry for the class
    let ancestors = this.hierarchyCache.get(pxObjClass);
    if (!ancestors) {
      ancestors = this.buildAncestors(pxObjClass);
      this.hierarchyCache.set(pxObjClass, ancestors);
    }

    return ancestors.has(potentialBaseClass);
  }

  private buildAncestors(pxObjClass: string): Set<string> {
    const ancestors = new Set<string>();
    if (pxObjClass === '@baseclass') {
      ancestors.add('@baseclass');
      return ancestors;
    }

    let current = pxObjClass;
    for (let i = 0; i < 20; i++) {
      const def = this.registry.getParser(current);
      if (!def || !def.baseClass) break;
      ancestors.add(def.baseClass);
      current = def.baseClass;
    }

    // Add @baseclass implicitly
    if (pxObjClass !== '@baseclass') {
      ancestors.add('@baseclass');
    }

    return ancestors;
  }

  private sortByInheritanceDepth(strategies: IPegaRuleParserStrategy[]): CompiledPegaRuleParserStrategy[] {
    const compiled = strategies as CompiledPegaRuleParserStrategy[];

    const getDepth = (strategy: CompiledPegaRuleParserStrategy): number => {
      const def = (strategy as any).classDef as PegaClassDefinition;
      let depth = 0;
      let current = def.baseClass;
      while (current) {
        depth++;
        const parentDef = this.registry.getParser(current);
        if (!parentDef || !parentDef.baseClass) break;
        current = parentDef.baseClass;
      }
      return depth;
    };

    // Sort by depth ascending (generic first) so unshift puts specific first
    return [...compiled].sort((a, b) => getDepth(a) - getDepth(b));
  }
}
