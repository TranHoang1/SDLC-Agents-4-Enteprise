import type { ArtifactAnalyzer, ArtifactAnalysis, ArtifactType } from '../types.js';
import { PegaSchemaInferrer } from '../../../../modules/pega/inference/PegaSchemaInferrer.js';
import { PegaFieldDocumentor } from '../../../../modules/pega/inference/PegaFieldDocumentor.js';
import { PegaSemanticAnalyzer } from '../../../../modules/pega/semantic/PegaSemanticAnalyzer.js';
import { PegaRuleSimulator } from '../../../../modules/pega/semantic/PegaRuleSimulator.js';
import { PegaReferenceExtractor } from '../../../../modules/pega/references/PegaReferenceExtractor.js';
import { PegaMetaModelRegistry } from '../../../../modules/pega/metamodel/PegaMetaModelRegistry.js';
import { PegaMetaModelCompiler } from '../../../../modules/pega/metamodel/PegaMetaModelCompiler.js';
import { PegaRuleUnderstandingService } from '../../../../modules/pega/understanding/PegaRuleUnderstandingService.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.resolve(__dirname, '../../../../modules/pega/schemas');

export class PegaRuleAnalyzer implements ArtifactAnalyzer {
  type: ArtifactType = 'pega_rule';

  private understandingService: PegaRuleUnderstandingService | null = null;
  private registry: PegaMetaModelRegistry | null = null;
  private initPromise: Promise<void> | null = null;

  canAnalyze(content: string): boolean {
    return content.includes('"pxObjClass"') || content.includes("'pxObjClass'");
  }

  async analyze(content: string, options?: Record<string, unknown>): Promise<ArtifactAnalysis> {
    await this.ensureInitialized();

    const json = JSON.parse(content) as Record<string, unknown>;
    const service = this.understandingService!;

    const simulate = options?.simulate === true;
    const understanding = await service.understand(json, { simulate });

    return {
      type: 'pega_rule',
      summary: `Pega Rule: ${understanding.name} (${understanding.pxObjClass}) — ${understanding.semantics.summary}`,
      promptContext: understanding.promptContext,
      details: {
        pxObjClass: understanding.pxObjClass,
        name: understanding.name,
        className: understanding.className,
        fqn: understanding.fqn,
        inferred: understanding.schema.inferred,
        dependencyCount: understanding.dependencies.length,
        sideEffectCount: understanding.semantics.sideEffects.length,
        hasSimulation: understanding.simulation !== null,
      },
      detectedBy: 'content-heuristic',
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (this.understandingService) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    const registry = PegaMetaModelRegistry.getInstance();
    this.registry = registry;

    try {
      if (!registry.isKnownClass('@baseclass')) {
        await registry.initialize(schemasDir);
      }
    } catch {
      // If schemas aren't available, the inferrer will infer from content
    }

    const inferrer = new PegaSchemaInferrer();
    const documentor = new PegaFieldDocumentor(inferrer);
    const analyzer = new PegaSemanticAnalyzer();
    const simulator = new PegaRuleSimulator();
    const extractor = new PegaReferenceExtractor();
    const compiler = new PegaMetaModelCompiler(registry);

    this.understandingService = new PegaRuleUnderstandingService(
      inferrer, documentor, analyzer, simulator, extractor, registry, compiler,
    );
  }
}
