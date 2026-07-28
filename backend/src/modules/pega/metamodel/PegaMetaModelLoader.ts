import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { PegaClassDefinition, PegaPropertyDef, PegaChildDef } from './PegaClassDefinition.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SYSTEM_FIELD_PREFIXES = ['pxCreate', 'pxUpdate', 'pxInstance', 'pxHost', 'pxMove', 'pxSibling',
  'pxLimitedAccess', 'pzChecksum', 'pzIndex', 'pzReindex', 'pzOriginal',
  'pxAllChangeList', 'pxWarnings', 'pxNamedPageReferences', 'pxAPIMethodReferences'];

const SYSTEM_FIELDS = new Set(['pxObjClass', 'pyClassName', 'pyRuleName', 'pyRuleset', 'pyRulesetVersion',
  'pyInsKey', 'pzInsKey', 'pxInsId', 'pxInsName',
  'pyRuleAvailable', 'pyModelName', 'pyActivityName',
  'pyTransformName', 'pyUserIdentifier', 'pyAccessGroup',
  'pyRuleSet', 'pyRuleSetVersion']);

const REFERENCE_FIELD_NAMES = new Set([
  'pyClassName', 'pySuperClass', 'pyPatternParent', 'pyDerivesFrom',
  'pyRuleName', 'pyModelName', 'pyActivityName', 'pyTransformName',
  'pyWhenCondition', 'pyOnChangeTrigger', 'pyFlowActionName',
  'pyFlowName', 'pyBlockName', 'pyPropertyName', 'pyMethodParameters',
]);

export class PegaMetaModelLoader {
  private registry: Map<string, PegaClassDefinition>;

  constructor() {
    this.registry = new Map();
  }

  public async loadSchemaDirectory(schemaDir?: string): Promise<Map<string, PegaClassDefinition>> {
    const dir = schemaDir || path.resolve(__dirname, '../schemas');
    this.registry = new Map();
    await this.scanDirectory(dir);
    this.resolveInheritance();
    return this.registry;
  }

  public loadSchemaFile(filePath: string): PegaClassDefinition | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return this.parseClassDefinition(parsed, path.basename(filePath));
    } catch {
      return null;
    }
  }

  public resolveInheritance(): void {
    const resolved = new Set<string>();

    const resolve = (className: string): PegaClassDefinition | undefined => {
      if (resolved.has(className)) return this.registry.get(className);
      const def = this.registry.get(className);
      if (!def) return undefined;
      if (def.baseClass && def.baseClass.length > 0) {
        const parentDef = resolve(def.baseClass);
        if (parentDef) {
          const mergedProps = this.mergeProperties(parentDef.properties, def.properties);
          const mergedChildren = this.mergeChildren(parentDef.children, def.children);
          def.properties = mergedProps;
          def.children = mergedChildren;
        }
      }
      resolved.add(className);
      return def;
    };

    for (const className of this.registry.keys()) {
      resolve(className);
    }
  }

  public registerClass(def: PegaClassDefinition): void {
    this.registry.set(def.pxObjClass, def);
  }

  public getClass(pxObjClass: string): PegaClassDefinition | undefined {
    return this.registry.get(pxObjClass);
  }

  public getAllClasses(): PegaClassDefinition[] {
    return Array.from(this.registry.values());
  }

  private async scanDirectory(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        const def = this.loadSchemaFile(fullPath);
        if (def) {
          const key = def.pxObjClass;
          if (!this.registry.has(key) || this.isRicherClassFile(entry.name)) {
            this.registry.set(key, def);
          }
        }
      }
    }
  }

  private isRicherClassFile(filename: string): boolean {
    return filename === '@baseclass.json' || filename.startsWith('Rule-') && filename.indexOf('.') === filename.lastIndexOf('.');
  }

  private parseClassDefinition(json: Record<string, unknown>, filename: string): PegaClassDefinition | null {
    if (!json || typeof json !== 'object') return null;

    let pxObjClass = '';
    let baseClass: string | undefined;
    let description: string | undefined;
    let label: string | undefined;

    if (json.pxObjClass === 'Rule-Obj-Class' && json.pyClassName) {
      pxObjClass = json.pyClassName as string;
      baseClass = (json.pyDerivesFrom as string) || (json.pySuperClass as string) || undefined;
      if (baseClass && baseClass.length === 0) baseClass = undefined;
      description = (json.pyDescription as string) || undefined;
      label = (json.pyLabel as string) || undefined;
    } else if (json.targetClass) {
      pxObjClass = json.targetClass as string;
      description = (json.description as string) || undefined;
    } else {
      return null;
    }

    const properties = this.extractProperties(json);
    const children = this.extractChildren(json);

    return { pxObjClass, baseClass, properties, children, description, label };
  }

  private extractProperties(json: Record<string, unknown>): PegaPropertyDef[] {
    const props: PegaPropertyDef[] = [];
    const visited = new Set<string>();

    for (const [key, val] of Object.entries(json)) {
      if (visited.has(key)) continue;
      visited.add(key);
      if (key === 'pxObjClass' || key === 'pyKeyDefList' || key === 'pxRuleReferences') continue;
      if (key === 'pxAllChangeList' || key === 'pxWarnings' || key === 'pxAPIMethodReferences' || key === 'pxNamedPageReferences') continue;

      const isSystem = SYSTEM_FIELD_PREFIXES.some(p => key.startsWith(p)) || key.startsWith('pz');
      const isReference = REFERENCE_FIELD_NAMES.has(key) || key.endsWith('Name') || key.endsWith('Class') || key === 'pxObjClass';
      const type = this.inferType(val, key);
      const required = key === 'pxObjClass' || key === 'pyClassName' || key === 'pyRuleName';

      if ((type as string) === 'object' || Array.isArray(val)) continue;

      props.push({ name: key, type, required, isSystem, isReference, description: undefined });
    }

    return props;
  }

  private extractChildren(json: Record<string, unknown>): PegaChildDef[] {
    const children: PegaChildDef[] = [];
    const skipArrays = new Set(['pxAllChangeList', 'pxWarnings', 'pxAPIMethodReferences', 'pxNamedPageReferences']);

    for (const [key, val] of Object.entries(json)) {
      if (skipArrays.has(key)) continue;
      if (key === 'pyKeyDefList' || key === 'pxRuleReferences') continue;
      if (!Array.isArray(val) || val.length === 0) continue;

      const firstItem = val[0];
      if (!firstItem || typeof firstItem !== 'object') continue;

      const itemType = (firstItem as Record<string, unknown>).pxObjClass as string || 'Embedded';
      children.push({
        name: key,
        childType: itemType,
        arrayType: 'array',
        description: undefined,
      });
    }

    const keyDefList = json.pyKeyDefList;
    if (Array.isArray(keyDefList) && keyDefList.length > 0) {
      children.push({
        name: 'pyKeyDefList',
        childType: 'Embed-ClassKeys',
        arrayType: 'array',
        description: 'Key definitions for the class',
      });
    }

    const pxRuleRefs = json.pxRuleReferences;
    if (Array.isArray(pxRuleRefs) && pxRuleRefs.length > 0) {
      children.push({
        name: 'pxRuleReferences',
        childType: 'Embed-Reference-Rule',
        arrayType: 'array',
        description: 'Rule references',
      });
    }

    return children;
  }

  private inferType(val: unknown, key: string): PegaPropertyDef['type'] {
    if (typeof val === 'number') return 'number';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'string') {
      if (REFERENCE_FIELD_NAMES.has(key) || key.endsWith('Name') || key.endsWith('Class') || key === 'pxObjClass') {
        return 'ref';
      }
      return 'string';
    }
    return 'string';
  }

  private mergeProperties(parent: PegaPropertyDef[], child: PegaPropertyDef[]): PegaPropertyDef[] {
    const childNames = new Set(child.map(p => p.name));
    const merged = [...child];
    for (const prop of parent) {
      if (!childNames.has(prop.name)) {
        merged.push(prop);
      }
    }
    return merged;
  }

  private mergeChildren(parent: PegaChildDef[], child: PegaChildDef[]): PegaChildDef[] {
    const childNames = new Set(child.map(c => c.name));
    const merged = [...child];
    for (const c of parent) {
      if (!childNames.has(c.name)) {
        merged.push(c);
      }
    }
    return merged;
  }
}
