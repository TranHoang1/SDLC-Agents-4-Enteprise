/**
 * KSA-149: Java Parser Unit Tests.
 * Tests symbol extraction, relationship extraction, and edge cases.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';
import JavaParser from '../java-parser.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const GRAMMAR_PATH = path.resolve(__dirname, '../../grammars/tree-sitter-java.wasm');

let parser: JavaParser;
let grammarAvailable = false;

async function setup(): Promise<void> {
  await Parser.init();
  const tsParser = new Parser();

  if (!fs.existsSync(GRAMMAR_PATH)) {
    console.error(`[SKIP] Java WASM grammar not found at ${GRAMMAR_PATH}`);
    return;
  }

  const language = await Language.load(GRAMMAR_PATH);
  tsParser.setLanguage(language);
  parser = new JavaParser(tsParser, 'java');
  grammarAvailable = true;
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

describe('JavaParser', () => {
  before(async () => {
    await setup();
  });

  describe('getSupportedExtensions', () => {
    it('should return .java', () => {
      if (!grammarAvailable) return;
      assert.deepEqual(parser.getSupportedExtensions(), ['.java']);
    });
  });

  describe('parse — SimpleClass.java', () => {
    it('should extract package declaration', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const pkg = result.symbols.find(s => s.kind === 'namespace');
      assert.ok(pkg, 'Should find package declaration');
      assert.equal(pkg.name, 'com.example.service');
      assert.ok(pkg.signature?.includes('package'));
    });

    it('should extract imports', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const imports = result.relationships.filter(r => r.kind === 'imports');
      assert.ok(imports.length >= 5, `Expected >=5 imports, got ${imports.length}`);

      // Regular import
      const listImport = imports.find(r => r.targetSymbol === 'java.util.List');
      assert.ok(listImport, 'Should find java.util.List import');

      // Static import
      const staticImport = imports.find(r => r.metadata?.static === true);
      assert.ok(staticImport, 'Should find static import');

      // Wildcard import
      const wildcardImport = imports.find(r => r.metadata?.wildcard === true);
      assert.ok(wildcardImport, 'Should find wildcard import');
      assert.ok(wildcardImport.targetSymbol.endsWith('.*'));
    });

    it('should extract class with inheritance', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const cls = result.symbols.find(s => s.name === 'UserService' && s.kind === 'class');
      assert.ok(cls, 'Should find UserService class');
      assert.ok(cls.modifiers?.includes('public'));
      assert.ok(cls.isExported);

      // Inheritance
      const inherits = result.relationships.find(
        r => r.sourceSymbol === 'UserService' && r.kind === 'inherits'
      );
      assert.ok(inherits, 'Should find extends BaseService');
      assert.equal(inherits.targetSymbol, 'BaseService');

      // Implements
      const implements_ = result.relationships.filter(
        r => r.sourceSymbol === 'UserService' && r.kind === 'implements'
      );
      assert.ok(implements_.length >= 2, 'Should implement Serializable and Auditable');
    });

    it('should extract constructor', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const ctor = result.symbols.find(s => s.kind === 'constructor' && s.parentName === 'UserService');
      assert.ok(ctor, 'Should find UserService constructor');
      assert.ok(ctor.parameters?.includes('UserRepository'));
    });

    it('should extract methods with return types', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const findById = result.symbols.find(s => s.name === 'findById' && s.parentName === 'UserService');
      assert.ok(findById, 'Should find findById method');
      assert.equal(findById.kind, 'method');
      assert.ok(findById.modifiers?.includes('public'));

      const findAll = result.symbols.find(s => s.name === 'findAll');
      assert.ok(findAll, 'Should find findAll method');
    });

    it('should extract fields with modifiers', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      // Static final constant
      const constant = result.symbols.find(s => s.name === 'DEFAULT_ROLE');
      assert.ok(constant, 'Should find DEFAULT_ROLE constant');
      assert.equal(constant.kind, 'constant');
      assert.ok(constant.modifiers?.includes('static'));
      assert.ok(constant.modifiers?.includes('final'));

      // Regular field
      const field = result.symbols.find(s => s.name === 'repository');
      assert.ok(field, 'Should find repository field');
      assert.equal(field.kind, 'property');
    });

    it('should extract inner classes', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const inner = result.symbols.find(s => s.name === 'UserBuilder');
      assert.ok(inner, 'Should find UserBuilder inner class');
      assert.equal(inner.parentName, 'UserService');
      assert.ok(inner.modifiers?.includes('static'));
    });

    it('should extract method calls', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const calls = result.relationships.filter(r => r.kind === 'calls');
      assert.ok(calls.length > 0, 'Should find method calls');

      // Should find constructor calls (new X())
      const ctorCalls = calls.filter(r => r.targetSymbol.includes('.constructor'));
      assert.ok(ctorCalls.length > 0, 'Should find constructor calls (new X())');
    });

    it('should calculate complexity', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const findById = result.symbols.find(s => s.name === 'findById');
      assert.ok(findById, 'Should find findById');
      assert.ok((findById.complexity ?? 0) > 1, 'findById should have complexity > 1 (has if statement)');
    });

    it('should handle private methods', () => {
      if (!grammarAvailable) return;
      const source = readFixture('SimpleClass.java');
      const result = parser.parse(source, 'SimpleClass.java');

      const privateMethod = result.symbols.find(s => s.name === 'notifyCreation');
      assert.ok(privateMethod, 'Should find notifyCreation');
      assert.ok(privateMethod.modifiers?.includes('private'));
      assert.equal(privateMethod.isExported, false);
    });
  });

  describe('parse — Annotations.java', () => {
    it('should extract annotations on classes', () => {
      if (!grammarAvailable) return;
      const source = readFixture('Annotations.java');
      const result = parser.parse(source, 'Annotations.java');

      const controller = result.symbols.find(s => s.name === 'UserController');
      assert.ok(controller, 'Should find UserController');
      assert.ok(controller.decorators?.includes('RestController'));
    });

    it('should extract annotations on methods', () => {
      if (!grammarAvailable) return;
      const source = readFixture('Annotations.java');
      const result = parser.parse(source, 'Annotations.java');

      const getUser = result.symbols.find(s => s.name === 'getUser');
      assert.ok(getUser, 'Should find getUser method');
      assert.ok(getUser.decorators?.includes('GetMapping'));
    });

    it('should extract record declarations', () => {
      if (!grammarAvailable) return;
      const source = readFixture('Annotations.java');
      const result = parser.parse(source, 'Annotations.java');

      const record = result.symbols.find(s => s.name === 'UserRecord');
      assert.ok(record, 'Should find UserRecord');
      assert.equal(record.kind, 'class');
      assert.ok(record.modifiers?.includes('record'));
    });

    it('should extract interfaces', () => {
      if (!grammarAvailable) return;
      const source = readFixture('Annotations.java');
      const result = parser.parse(source, 'Annotations.java');

      const iface = result.symbols.find(s => s.name === 'UserRepository');
      assert.ok(iface, 'Should find UserRepository interface');
      assert.equal(iface.kind, 'interface');

      // Should have extends relationship
      const inherits = result.relationships.find(
        r => r.sourceSymbol === 'UserRepository' && r.kind === 'inherits'
      );
      assert.ok(inherits, 'Should find extends JpaRepository');
    });

    it('should extract enums', () => {
      if (!grammarAvailable) return;
      const source = readFixture('Annotations.java');
      const result = parser.parse(source, 'Annotations.java');

      const enumType = result.symbols.find(s => s.name === 'UserRole');
      assert.ok(enumType, 'Should find UserRole enum');
      assert.equal(enumType.kind, 'enum');
    });

    it('should create decorator relationships for annotations', () => {
      if (!grammarAvailable) return;
      const source = readFixture('Annotations.java');
      const result = parser.parse(source, 'Annotations.java');

      const decorates = result.relationships.filter(r => r.kind === 'decorates');
      assert.ok(decorates.length > 0, 'Should find decorator relationships');

      const restController = decorates.find(r => r.targetSymbol === 'RestController');
      assert.ok(restController, 'Should find @RestController decorator relationship');
    });
  });

  describe('error handling', () => {
    it('should handle empty source', () => {
      if (!grammarAvailable) return;
      const result = parser.parse('', 'Empty.java');
      assert.equal(result.symbols.length, 0);
      assert.equal(result.relationships.length, 0);
      assert.equal(result.errors.length, 0);
    });

    it('should handle source with syntax errors gracefully', () => {
      if (!grammarAvailable) return;
      const source = `
package com.example;

public class ValidClass {
    public void validMethod() {
        System.out.println("hello");
    }

    public void brokenMethod( {
        // syntax error
    }
}
`;
      const result = parser.parse(source, 'Broken.java');
      const validClass = result.symbols.find(s => s.name === 'ValidClass');
      assert.ok(validClass, 'Should still extract ValidClass');
    });
  });
});
