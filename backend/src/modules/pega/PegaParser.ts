/**
 * PegaParser — Bộ phân tích Pega Rule & Data tích hợp OOP Domain Model và Strategy Registry.
 */

import type { UnresolvedDependency } from './models.js';
import { PegaParserRegistry } from './strategies/PegaParserRegistry.js';
import { PegaObjectFactory } from './domain/PegaObjectFactory.js';
import { PegaRule } from './domain/PegaRule.js';
import { PegaObject } from './domain/PegaObject.js';

export interface ExtractedPegaSymbol {
  fqn: string;
  name: string;
  className: string;
  ruleType: string;
  isRule: boolean;
  ruleset?: string;
  version?: string;
  logicSummary?: string;
}

export class PegaParser {
  private registry: PegaParserRegistry;

  constructor() {
    this.registry = new PegaParserRegistry();
  }

  public parsePegaObject(json: Record<string, unknown>): PegaObject {
    return PegaObjectFactory.create(json);
  }

  public parseSymbol(json: Record<string, unknown>): ExtractedPegaSymbol {
    const pegaObj = this.parsePegaObject(json);
    if (pegaObj instanceof PegaRule) {
      return {
        fqn: pegaObj.getFqn(),
        name: pegaObj.pyRuleName,
        className: pegaObj.pyClassName,
        ruleType: pegaObj.pxObjClass,
        isRule: true,
        ruleset: pegaObj.pyRuleset,
        version: pegaObj.pyRulesetVersion,
        logicSummary: pegaObj.toStructuredPseudoCode(),
      };
    }
    return this.registry.parse(json).symbol;
  }

  public extractDependencies(json: Record<string, unknown>): UnresolvedDependency[] {
    const pegaObj = this.parsePegaObject(json);
    if (pegaObj instanceof PegaRule) {
      return pegaObj.extractDependencies();
    }
    return this.registry.parse(json).dependencies;
  }
}
