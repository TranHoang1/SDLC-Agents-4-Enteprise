/**
 * PegaMetaModelService — Orchestrates the full pipeline:
 * load schemas → compile strategies → register all in one call.
 */

import { PegaMetaModelLoader } from './PegaMetaModelLoader.js';
import { PegaMetaModelRegistry } from './PegaMetaModelRegistry.js';
import { PegaMetaModelCompiler } from './PegaMetaModelCompiler.js';
import { PegaParserRegistry } from '../strategies/PegaParserRegistry.js';

export class PegaMetaModelService {
  private loader: PegaMetaModelLoader;
  private compiler: PegaMetaModelCompiler;
  private registry: PegaParserRegistry;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(parserRegistry?: PegaParserRegistry) {
    this.loader = new PegaMetaModelLoader();
    this.registry = parserRegistry || new PegaParserRegistry();
    this.compiler = new PegaMetaModelCompiler(PegaMetaModelRegistry.getInstance());
  }

  /**
   * One-call initialization: loads schemas, compiles strategies, registers all.
   */
  public async initialize(schemaDir?: string): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize(schemaDir);
    return this.initPromise;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getCompiler(): PegaMetaModelCompiler {
    return this.compiler;
  }

  public getRegistry(): PegaParserRegistry {
    return this.registry;
  }

  public getLoader(): PegaMetaModelLoader {
    return this.loader;
  }

  private async doInitialize(schemaDir?: string): Promise<void> {
    // 1. Initialize the singleton registry (loads all schemas)
    const metaRegistry = PegaMetaModelRegistry.getInstance();
    await metaRegistry.initialize(schemaDir);

    // 2. Compile all registered class definitions into strategies
    this.compiler.compileAll();

    // 3. Register all compiled strategies into the parser registry
    this.compiler.registerAll(this.registry);

    this.initialized = true;
  }
}
