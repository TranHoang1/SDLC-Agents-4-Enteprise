import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import type { PegaMetaModelRegistry } from '../metamodel/PegaMetaModelRegistry.js';
import type { PegaClassDefinition, PegaPropertyDef, PegaChildDef } from '../metamodel/PegaClassDefinition.js';
import type { PegaRuleKbSchema } from '../strategies/KbDrivenPegaParserStrategy.js';
import { PegaSchemaInferrer } from './PegaSchemaInferrer.js';
import type { Logger } from 'pino';

export class PegaSchemaKBService {
  constructor(
    private adapter: DatabaseAdapter,
    private registry: PegaMetaModelRegistry,
    private inferrer: PegaSchemaInferrer,
    private logger?: Logger,
  ) {}

  async saveSchemaToKB(def: PegaClassDefinition, projectId?: string): Promise<void> {
    const sourceKey = `pega-schema:${def.pxObjClass}`;
    const existing = await this.adapter.getAsync<{ id: number }>(
      "SELECT id FROM knowledge_entries WHERE source = ? AND type = 'PEGA_SCHEMA'",
      [sourceKey],
    );
    if (existing) return;

    const kbSchema = this.toKbSchema(def);

    await this.adapter.runAsync(
      `INSERT INTO knowledge_entries (content, summary, type, tier, scope, project_id, source, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        JSON.stringify(kbSchema),
        `Pega Rule Schema: ${def.pxObjClass}`,
        'PEGA_SCHEMA',
        'SEMANTIC',
        'SHARED',
        projectId ?? null,
        sourceKey,
        'pega,schema',
      ],
    );

    this.logger?.info({ pxObjClass: def.pxObjClass }, 'Saved Pega schema to KB');
  }

  async loadSchemasFromKB(): Promise<number> {
    const rows = await this.adapter.allAsync<{ content: string }>(
      "SELECT content FROM knowledge_entries WHERE type = 'PEGA_SCHEMA'",
      [],
    );

    let loaded = 0;
    for (const row of rows) {
      try {
        const kbSchema = JSON.parse(row.content) as PegaRuleKbSchema;
        const def = this.fromKbSchema(kbSchema);
        this.registry.registerClass(def);
        loaded++;
      } catch (err) {
        this.logger?.warn({ err }, 'Skipped corrupted PEGA_SCHEMA entry');
      }
    }

    this.logger?.info({ count: loaded }, 'Loaded Pega schemas from KB');
    return loaded;
  }

  async learnSchema(pxObjClass: string, json: Record<string, unknown>, projectId?: string): Promise<PegaClassDefinition> {
    const wasKnown = this.registry.isKnownClass(pxObjClass);
    const def = this.inferrer.ensureSchema(pxObjClass, json, this.registry);

    if (!wasKnown) {
      await this.saveSchemaToKB(def, projectId);
    }

    return def;
  }

  toKbSchema(def: PegaClassDefinition): PegaRuleKbSchema {
    const nameProperty = def.properties.find(
      p => p.name.endsWith('Name') || p.name === 'pyLabel',
    )?.name ?? def.properties[0]?.name;

    const keyFields = def.properties
      .filter(p => !p.isSystem)
      .map(p => p.name);

    const contextFields = def.children.map(c => c.name);

    const dependencyPaths = def.properties
      .filter(p => p.isReference)
      .map(p => p.name);

    return {
      targetClass: def.pxObjClass,
      displayName: def.label,
      description: def.description,
      nameProperty,
      keyFields,
      contextFields,
      dependencyPaths,
      semantics: {
        baseClass: def.baseClass,
        properties: def.properties,
        children: def.children,
      },
    };
  }

  fromKbSchema(kb: PegaRuleKbSchema): PegaClassDefinition {
    const semanticsProps = kb.semantics?.properties;
    const semanticsChildren = kb.semantics?.children;

    if (semanticsProps && Array.isArray(semanticsProps)) {
      const properties = semanticsProps as PegaPropertyDef[];
      const children = (Array.isArray(semanticsChildren) ? semanticsChildren : []) as PegaChildDef[];

      return {
        pxObjClass: kb.targetClass,
        properties,
        children,
        description: kb.description,
        label: kb.displayName,
        baseClass: (kb.semantics?.baseClass as string) || this.inferrer.inferBaseClass(kb.targetClass, this.registry) || '@baseclass',
      };
    }

    const properties: PegaPropertyDef[] = [];
    const children: PegaChildDef[] = [];

    if (kb.keyFields) {
      for (const field of kb.keyFields) {
        const isRef = kb.dependencyPaths?.includes(field) ?? false;
        properties.push({
          name: field,
          type: isRef ? 'ref' : 'string',
          required: ['pxObjClass', 'pyClassName', 'pyRuleName'].includes(field),
          isSystem: field.startsWith('px') || field.startsWith('pz'),
          isReference: isRef,
        });
      }
    }

    if (kb.contextFields) {
      for (const field of kb.contextFields) {
        children.push({
          name: field,
          childType: 'Embedded',
          arrayType: 'array',
        });
      }
    }

    return {
      pxObjClass: kb.targetClass,
      properties,
      children,
      description: kb.description,
      label: kb.displayName,
      baseClass: (kb.semantics?.baseClass as string) || this.inferrer.inferBaseClass(kb.targetClass, this.registry) || '@baseclass',
    };
  }
}
