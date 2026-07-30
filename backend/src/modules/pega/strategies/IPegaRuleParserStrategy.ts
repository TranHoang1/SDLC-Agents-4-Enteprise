/**
 * IPegaRuleParserStrategy — Giao diện chiến lược phân tích cho từng loại Pega Rule/Data.
 * Áp dụng Design Pattern: Strategy Pattern.
 */

import type { UnresolvedDependency } from '../models.js';
import type { ExtractedPegaSymbol } from '../PegaParser.js';

export interface ParseResult {
  symbol: ExtractedPegaSymbol;
  dependencies: UnresolvedDependency[];
}

export interface IPegaRuleParserStrategy {
  supports(pxObjClass: string): boolean;
  parse(json: Record<string, unknown>): ParseResult;
}
