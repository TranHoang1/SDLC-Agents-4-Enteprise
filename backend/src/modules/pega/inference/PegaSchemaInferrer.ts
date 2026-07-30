import type { PegaClassDefinition, PegaPropertyDef, PegaChildDef } from '../metamodel/PegaClassDefinition.js';
import type { PegaMetaModelRegistry } from '../metamodel/PegaMetaModelRegistry.js';

const SYSTEM_FIELD_PREFIXES = ['pxCreate', 'pxUpdate', 'pxInstance', 'pxHost', 'pxMove', 'pxSibling',
  'pxLimitedAccess', 'pzChecksum', 'pzIndex', 'pzReindex', 'pzOriginal',
  'pxAllChangeList', 'pxWarnings', 'pxNamedPageReferences', 'pxAPIMethodReferences'];

const REFERENCE_SUFFIXES = ['Name', 'Class', 'Profile', 'Transform', 'Condition', 'From', 'Evaluated', 'Trigger', 'Action', 'Target', 'Source', 'Expression'];

export type SchemaInferredCallback = (def: PegaClassDefinition, sourceJson: Record<string, unknown>) => void | Promise<void>;

export class PegaSchemaInferrer {

  public onSchemaInferred?: SchemaInferredCallback;

  public inferFromRule(pxObjClass: string, json: Record<string, unknown>): PegaClassDefinition {
    const properties = this.inferProperties(json);
    const children = this.inferChildren(json);
    return { pxObjClass, properties, children };
  }

  public inferProperties(json: Record<string, unknown>): PegaPropertyDef[] {
    const props: PegaPropertyDef[] = [];
    const visited = new Set<string>();

    for (const [key, val] of Object.entries(json)) {
      if (visited.has(key)) continue;
      visited.add(key);

      if (key === 'pxObjClass' || key === 'pyClassName' || key === 'pyRuleName') continue;
      if (key === 'pxAllChangeList' || key === 'pxWarnings' || key === 'pxAPIMethodReferences' || key === 'pxNamedPageReferences') continue;

      const isSystem = SYSTEM_FIELD_PREFIXES.some(p => key.startsWith(p)) || key.startsWith('pz');

      if (Array.isArray(val)) continue;
      if (typeof val === 'object' && val !== null) continue;

      const type = this.inferType(val, key);
      const isReference = this.isReferenceField(key);
      const required = key === 'pxObjClass' || key === 'pyClassName' || key === 'pyRuleName';

      props.push({ name: key, type, required, isSystem, isReference });
    }

    return this.deduplicateProperties(props);
  }

  public inferChildren(json: Record<string, unknown>): PegaChildDef[] {
    const children: PegaChildDef[] = [];
    const skipArrays = new Set(['pxAllChangeList', 'pxWarnings', 'pxAPIMethodReferences', 'pxNamedPageReferences']);

    for (const [key, val] of Object.entries(json)) {
      if (skipArrays.has(key)) continue;
      if (!Array.isArray(val) || val.length === 0) continue;

      const firstItem = val[0];
      if (!firstItem || typeof firstItem !== 'object') continue;

      const itemType = (firstItem as Record<string, unknown>).pxObjClass as string || 'Embedded';
      children.push({ name: key, childType: itemType, arrayType: 'array' });
    }

    return children;
  }

  public inferBaseClass(pxObjClass: string, registry: PegaMetaModelRegistry): string {
    if (pxObjClass === '@baseclass') return '';

    const segments = pxObjClass.split('-');

    for (let i = segments.length - 1; i >= 1; i--) {
      const candidate = segments.slice(0, i).join('-') + '-';
      if (candidate === pxObjClass) continue;
      if (registry.isKnownClass(candidate)) return candidate;
    }

    return '@baseclass';
  }

  public hasKnownSchema(pxObjClass: string, registry: PegaMetaModelRegistry): boolean {
    return registry.isKnownClass(pxObjClass);
  }

  public ensureSchema(pxObjClass: string, json: Record<string, unknown>, registry: PegaMetaModelRegistry): PegaClassDefinition {
    const existing = registry.getParser(pxObjClass);
    if (existing) return existing;

    const baseClass = this.inferBaseClass(pxObjClass, registry);
    const def = this.inferFromRule(pxObjClass, json);
    if (baseClass) def.baseClass = baseClass;

    registry.registerClass(def);
    return def;
  }

  public async ensureSchemaAsync(pxObjClass: string, json: Record<string, unknown>, registry: PegaMetaModelRegistry): Promise<PegaClassDefinition> {
    const existing = registry.getParser(pxObjClass);
    if (existing) return existing;

    const baseClass = this.inferBaseClass(pxObjClass, registry);
    const def = this.inferFromRule(pxObjClass, json);
    if (baseClass) def.baseClass = baseClass;

    registry.registerClass(def);

    if (this.onSchemaInferred) {
      await this.onSchemaInferred(def, json);
    }

    return def;
  }

  public isReferenceField(key: string): boolean {
    if (key === 'pxObjClass') return true;
    return REFERENCE_SUFFIXES.some(s => key.endsWith(s));
  }

  private inferType(val: unknown, key: string): PegaPropertyDef['type'] {
    if (typeof val === 'number') return 'number';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'string') {
      if (key === 'pxObjClass') return 'ref';
      if (this.isReferenceField(key)) return 'ref';
      if (val.includes('.') && val.split('.').every(s => /^[A-Za-z][A-Za-z0-9_.-]*$/.test(s))) return 'ref';
      return 'string';
    }
    return 'string';
  }

  private deduplicateProperties(props: PegaPropertyDef[]): PegaPropertyDef[] {
    const seen = new Set<string>();
    return props.filter(p => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }
}
