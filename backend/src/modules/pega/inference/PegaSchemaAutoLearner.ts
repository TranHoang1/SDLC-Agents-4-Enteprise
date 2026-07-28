import type { IPegaRuleParserStrategy } from '../strategies/IPegaRuleParserStrategy.js';
import type { PegaMetaModelCompiler } from '../metamodel/PegaMetaModelCompiler.js';
import { PegaSchemaKBService } from './PegaSchemaKBService.js';

export class PegaSchemaAutoLearner {
  constructor(
    private kbService: PegaSchemaKBService,
    private compiler: PegaMetaModelCompiler,
  ) {}

  async learn(pxObjClass: string, json: Record<string, unknown>, projectId?: string): Promise<IPegaRuleParserStrategy> {
    const def = await this.kbService.learnSchema(pxObjClass, json, projectId);
    const strategy = this.compiler.compileStrategy(def);
    return strategy;
  }

  async initialize(): Promise<void> {
    const loaded = await this.kbService.loadSchemasFromKB();
    if (loaded > 0) {
      this.compiler.compileAll();
    }
  }
}
