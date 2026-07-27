/**
 * PegaDeclare — Module entry point for Pega Declarative Rules parsing.
 *
 * Exports types and the parser, and auto-registers with PegaParserRegistry.
 */

export { PegaDeclareParser } from './PegaDeclareParser.js';
export type {
  DeclareType,
  PegaDeclareRule,
  PegaDeclareExpression,
  PegaDeclareOnChange,
  DeclareOnChangeAction,
  PegaDeclareTrigger,
  PegaDeclarePages,
  DeclarePageDefinition,
  PegaDeclareConstraint,
  PegaDeclareIndex,
  PegaDeclareDecisionTable,
  PegaDeclareDecisionTree,
  DeclareDecisionRow,
} from './PegaDeclareTypes.js';

import { PegaDeclareParser } from './PegaDeclareParser.js';
import { PegaParserRegistry } from '../strategies/PegaParserRegistry.js';

/**
 * Register the PegaDeclareParser with the global PegaParserRegistry.
 * Call once during application bootstrap.
 */
export function registerDeclareParsers(registry: PegaParserRegistry): void {
  registry.registerStrategy(new PegaDeclareParser());
}