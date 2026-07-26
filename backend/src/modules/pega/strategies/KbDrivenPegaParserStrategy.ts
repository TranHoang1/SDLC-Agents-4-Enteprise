/**
 * KbDrivenPegaParserStrategy — Phân tích Pega Rule/Data dựa trên tri thức Schema phong phú từ KB.
 * Hỗ trợ bóc tách đệ quy linh hoạt qua JSONPath mà không ảo giác.
 */

import type { IPegaRuleParserStrategy, ParseResult } from './IPegaRuleParserStrategy.js';
import type { UnresolvedDependency } from '../models.js';

export interface PegaRuleKbSchema {
  targetClass: string;
  displayName?: string;
  description?: string;
  nameProperty?: string;
  keyFields?: string[];
  contextFields?: string[];
  dependencyPaths: string[];
  semantics?: Record<string, unknown>;
}

export class KbDrivenPegaParserStrategy implements IPegaRuleParserStrategy {
  private schemaMap = new Map<string, PegaRuleKbSchema>();

  public addSchema(schema: PegaRuleKbSchema): void {
    this.schemaMap.set(schema.targetClass, schema);
  }

  public supports(pxObjClass: string): boolean {
    return this.schemaMap.has(pxObjClass);
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const pxObjClass = (json.pxObjClass as string) || 'Rule-Obj-Activity';
    const schema = this.schemaMap.get(pxObjClass);
    const className = (json.pyClassName as string) || (json.className as string) || '@baseclass';
    const nameProp = schema?.nameProperty || 'pyLabel';
    const name = (json[nameProp] as string) || (json.pyRuleName as string) || (json.pyLabel as string) || 'Unnamed';
    const fqn = `${pxObjClass}:${className}:${name}`;

    const symbol = {
      fqn,
      name,
      className,
      ruleType: pxObjClass,
      isRule: pxObjClass.startsWith('Rule-'),
      ruleset: (json.pyRuleset as string) || undefined,
      version: (json.pyRulesetVersion as string) || undefined,
    };

    const dependencies = this.extractDependenciesBySchema(json, schema?.dependencyPaths || []);
    return { symbol, dependencies };
  }

  private extractDependenciesBySchema(json: Record<string, unknown>, paths: string[]): UnresolvedDependency[] {
    const deps: UnresolvedDependency[] = [];
    for (const pathStr of paths) {
      this.extractByPath(json, pathStr, deps);
    }
    return deps;
  }

  private extractByPath(json: Record<string, unknown>, pathStr: string, deps: UnresolvedDependency[]): void {
    if (pathStr.includes('[].')) {
      const [arrayProp, targetProp] = pathStr.split('[].');
      const arr = Array.isArray(json[arrayProp]) ? (json[arrayProp] as any[]) : [];
      for (const item of arr) {
        if (item && typeof item === 'object' && typeof item[targetProp] === 'string' && item[targetProp].trim()) {
          deps.push({ ruleType: 'Unknown', className: '@baseclass', ruleName: item[targetProp].trim() });
        }
      }
    } else if (typeof json[pathStr] === 'string' && (json[pathStr] as string).trim()) {
      deps.push({ ruleType: 'Unknown', className: '@baseclass', ruleName: (json[pathStr] as string).trim() });
    }
  }
}
