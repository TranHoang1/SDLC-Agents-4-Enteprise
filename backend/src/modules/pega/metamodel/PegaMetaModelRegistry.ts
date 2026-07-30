import type { PegaClassDefinition } from './PegaClassDefinition.js';
import { PegaMetaModelLoader } from './PegaMetaModelLoader.js';

export class PegaMetaModelRegistry {
  private static instance: PegaMetaModelRegistry;
  private loader: PegaMetaModelLoader;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.loader = new PegaMetaModelLoader();
  }

  public static getInstance(): PegaMetaModelRegistry {
    if (!PegaMetaModelRegistry.instance) {
      PegaMetaModelRegistry.instance = new PegaMetaModelRegistry();
    }
    return PegaMetaModelRegistry.instance;
  }

  public async initialize(schemaDir?: string): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize(schemaDir);
    return this.initPromise;
  }

  public registerClass(def: PegaClassDefinition): void {
    this.loader.registerClass(def);
  }

  public getParser(pxObjClass: string): PegaClassDefinition | undefined {
    return this.loader.getClass(pxObjClass);
  }

  public isKnownClass(pxObjClass: string): boolean {
    return this.loader.getClass(pxObjClass) !== undefined;
  }

  public getKnownClasses(): string[] {
    return this.loader.getAllClasses().map(c => c.pxObjClass);
  }

  private async doInitialize(schemaDir?: string): Promise<void> {
    await this.loader.loadSchemaDirectory(schemaDir);
    this.initialized = true;
  }
}
