import { describe, it, expect } from 'vitest';
import { PegaMetaModelLoader, PegaMetaModelRegistry } from '../../metamodel/index.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.resolve(__dirname, '../../schemas');

describe('PegaMetaModelLoader', () => {
  describe('loadSchemaDirectory', () => {
    it('loads schema directory and returns non-empty registry', async () => {
      const loader = new PegaMetaModelLoader();
      const registry = await loader.loadSchemaDirectory(schemasDir);
      expect(registry.size).toBeGreaterThanOrEqual(20);
    });

    it('loads more than 100 classes including base classes', async () => {
      const loader = new PegaMetaModelLoader();
      const registry = await loader.loadSchemaDirectory(schemasDir);
      expect(registry.size).toBeGreaterThan(100);
    });
  });

  describe('Rule-Obj-Activity class definition', () => {
    it('loads with correct pxObjClass', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('Rule-Obj-Activity');
      expect(def).toBeDefined();
      expect(def!.pxObjClass).toBe('Rule-Obj-Activity');
    });

    it('has properties including label and description', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('Rule-Obj-Activity');
      expect(def).toBeDefined();
      const propNames = def!.properties.map(p => p.name);
      expect(propNames).toContain('pyLabel');
      expect(propNames).toContain('pyDescription');
      expect(propNames).toContain('pyClassName');
    });

    it('has correct baseClass', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('Rule-Obj-Activity');
      expect(def).toBeDefined();
      expect(def!.baseClass).toBe('Rule-Obj-');
    });

    it('has children definitions', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('Rule-Obj-Activity');
      expect(def).toBeDefined();
      expect(def!.children.length).toBeGreaterThanOrEqual(1);
      const childNames = def!.children.map(c => c.name);
      expect(childNames).toContain('pyKeyDefList');
    });
  });

  describe('inheritance resolution', () => {
    it('resolves Rule-Obj-Activity inheriting from Rule-Obj-', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const activityDef = loader.getClass('Rule-Obj-Activity');
      const objDef = loader.getClass('Rule-Obj-');
      expect(activityDef).toBeDefined();
      expect(objDef).toBeDefined();
      const activityProps = new Set(activityDef!.properties.map(p => p.name));
      for (const parentProp of objDef!.properties) {
        expect(activityProps.has(parentProp.name)).toBe(true);
      }
    });

    it('resolves Rule-Obj- inheriting from Rule-', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const objDef = loader.getClass('Rule-Obj-');
      const ruleDef = loader.getClass('Rule-');
      expect(objDef).toBeDefined();
      expect(ruleDef).toBeDefined();
      const objProps = new Set(objDef!.properties.map(p => p.name));
      for (const parentProp of ruleDef!.properties) {
        expect(objProps.has(parentProp.name)).toBe(true);
      }
    });

    it('resolves Rule- inheriting from @baseclass', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const ruleDef = loader.getClass('Rule-');
      const baseDef = loader.getClass('@baseclass');
      expect(ruleDef).toBeDefined();
      expect(baseDef).toBeDefined();
      const ruleProps = new Set(ruleDef!.properties.map(p => p.name));
      for (const parentProp of baseDef!.properties) {
        expect(ruleProps.has(parentProp.name)).toBe(true);
      }
    });

    it('Rule-Obj-Activity indirectly inherits properties from @baseclass', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const activityDef = loader.getClass('Rule-Obj-Activity');
      const baseDef = loader.getClass('@baseclass');
      expect(activityDef).toBeDefined();
      expect(baseDef).toBeDefined();
      const activityProps = new Set(activityDef!.properties.map(p => p.name));
      for (const parentProp of baseDef!.properties) {
        expect(activityProps.has(parentProp.name)).toBe(true);
      }
    });
  });

  describe('class lookup', () => {
    it('known class returns correct definition', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('Rule-Obj-Model');
      expect(def).toBeDefined();
      expect(def!.pxObjClass).toBe('Rule-Obj-Model');
      expect(def!.label).toBe('Data Transform');
    });

    it('unknown class returns undefined', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('NonExistent-Class-XYZ');
      expect(def).toBeUndefined();
    });

    it('getAllClasses returns all definitions', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const all = loader.getAllClasses();
      expect(all.length).toBeGreaterThan(100);
      expect(all.some(c => c.pxObjClass === 'Rule-Obj-Activity')).toBe(true);
      expect(all.some(c => c.pxObjClass === '@baseclass')).toBe(true);
    });
  });

  describe('child definitions', () => {
    it('Rule-Obj-Activity has pyLinks children', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('Rule-Obj-Activity');
      expect(def).toBeDefined();
      const childNames = def!.children.map(c => c.name);
      expect(childNames).toContain('pyLinks');
    });

    it('Rule-Obj-Activity has pyPagesAndClasses and pyValidRuleSets children', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('Rule-Obj-Activity');
      expect(def).toBeDefined();
      const childNames = new Set(def!.children.map(c => c.name));
      expect(childNames.has('pyPagesAndClasses')).toBe(true);
      expect(childNames.has('pyValidRuleSets')).toBe(true);
    });

    it('@baseclass has embedded children like pyLinks', async () => {
      const loader = new PegaMetaModelLoader();
      await loader.loadSchemaDirectory(schemasDir);
      const def = loader.getClass('@baseclass');
      expect(def).toBeDefined();
      expect(def!.children.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('error handling', () => {
    it('handles missing directory gracefully', async () => {
      const loader = new PegaMetaModelLoader();
      const registry = await loader.loadSchemaDirectory('/nonexistent/path');
      expect(registry.size).toBe(0);
    });

    it('loadSchemaFile returns null for invalid file', () => {
      const loader = new PegaMetaModelLoader();
      const def = loader.loadSchemaFile('/nonexistent/file.json');
      expect(def).toBeNull();
    });

    it('loadSchemaFile correctly loads a valid class definition file', async () => {
      const rulesDir = path.resolve(__dirname, '../../schemas/rules');
      const loader = new PegaMetaModelLoader();
      const result = loader.loadSchemaFile(path.join(rulesDir, '@baseclass.json'));
      expect(result).toBeDefined();
      expect(result!.pxObjClass).toBe('@baseclass');
    });
  });

  describe('PegaMetaModelRegistry singleton', () => {
    it('getInstance returns the same instance', () => {
      const instance1 = PegaMetaModelRegistry.getInstance();
      const instance2 = PegaMetaModelRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('can initialize and lookup classes', async () => {
      const registry = PegaMetaModelRegistry.getInstance();
      await registry.initialize(schemasDir);
      expect(registry.isKnownClass('Rule-Obj-Activity')).toBe(true);
      expect(registry.isKnownClass('NonExistent')).toBe(false);
    });

    it('getKnownClasses returns all class names', async () => {
      const registry = PegaMetaModelRegistry.getInstance();
      await registry.initialize(schemasDir);
      const known = registry.getKnownClasses();
      expect(known).toContain('Rule-Obj-Activity');
      expect(known).toContain('@baseclass');
      expect(known.length).toBeGreaterThan(100);
    });

    it('getParser returns class definition', async () => {
      const registry = PegaMetaModelRegistry.getInstance();
      await registry.initialize(schemasDir);
      const def = registry.getParser('Rule-Obj-Flow');
      expect(def).toBeDefined();
      expect(def!.pxObjClass).toBe('Rule-Obj-Flow');
      expect(def!.label).toBe('Flow');
    });

    it('registerClass adds a class and getParser retrieves it', async () => {
      const registry = PegaMetaModelRegistry.getInstance();
      const newClass = {
        pxObjClass: 'Rule-Obj-MyCustom',
        baseClass: 'Rule-Obj-',
        properties: [],
        children: [],
        label: 'My Custom Rule',
        description: 'A dynamically registered rule type',
      };
      registry.registerClass(newClass);
      const retrieved = registry.getParser('Rule-Obj-MyCustom');
      expect(retrieved).toBeDefined();
      expect(retrieved!.pxObjClass).toBe('Rule-Obj-MyCustom');
      expect(retrieved!.label).toBe('My Custom Rule');
    });
  });
});
