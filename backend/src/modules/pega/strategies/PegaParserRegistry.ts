/**
 * PegaParserRegistry — Quản lý và cung cấp Strategy phù hợp theo pxObjClass.
 */

import type { IPegaRuleParserStrategy, ParseResult } from './IPegaRuleParserStrategy.js';
import { ActivityParserStrategy } from './ActivityParserStrategy.js';
import { DataTransformParserStrategy } from './DataTransformParserStrategy.js';
import { KbDrivenPegaParserStrategy } from './KbDrivenPegaParserStrategy.js';
import { DefaultPegaParserStrategy } from './DefaultPegaParserStrategy.js';

export class PegaParserRegistry {
  private strategies: IPegaRuleParserStrategy[] = [];
  private fallbackStrategy: IPegaRuleParserStrategy;

  constructor() {
    this.strategies.push(new ActivityParserStrategy());
    this.strategies.push(new DataTransformParserStrategy());
    this.strategies.push(new KbDrivenPegaParserStrategy());
    this.fallbackStrategy = new DefaultPegaParserStrategy();
  }

  public registerStrategy(strategy: IPegaRuleParserStrategy): void {
    this.strategies.unshift(strategy);
  }

  public parse(json: Record<string, unknown>): ParseResult {
    const pxObjClass = (json.pxObjClass as string) || '';
    const strategy = this.strategies.find((s) => s.supports(pxObjClass)) || this.fallbackStrategy;
    return strategy.parse(json);
  }
}
