/**
 * KSA-191: Salesforce Metadata Parser Unit Tests.
 * Tests XML-based symbol and relationship extraction for Flows, Objects, Fields.
 * No WASM grammar needed — this parser uses regex-based XML extraction.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import * as fs from 'fs';
import SalesforceMetaParser from '../salesforce-meta-parser.js';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/salesforce-meta');

let parser: SalesforceMetaParser;

function setup(): void {
  // SalesforceMetaParser receives null as parser (no tree-sitter)
  parser = new SalesforceMetaParser(null, 'salesforce-meta');
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

setup();

describe('SalesforceMetaParser', () => {
  describe('getSupportedExtensions', () => {
    it('should return all SF metadata extensions', () => {
      const exts = parser.getSupportedExtensions();
      assert.ok(exts.includes('.flow-meta.xml'));
      assert.ok(exts.includes('.object-meta.xml'));
      assert.ok(exts.includes('.field-meta.xml'));
      assert.ok(exts.includes('.js-meta.xml'));
      assert.ok(exts.includes('.component-meta.xml'));
    });
  });

  describe('constructor with null parser', () => {
    it('should not crash when parser is null', () => {
      const p = new SalesforceMetaParser(null, 'salesforce-meta');
      assert.equal(p.languageId, 'salesforce-meta');
    });
  });

  describe('parse — SimpleFlow.flow-meta.xml', () => {
    it('should extract flow as class symbol', () => {
      const source = readFixture('SimpleFlow.flow-meta.xml');
      const result = parser.parse(source, 'force-app/main/default/flows/SimpleFlow.flow-meta.xml');

      const flow = result.symbols.find(s => s.kind === 'class');
      assert.ok(flow, 'Should find flow symbol');
      assert.equal(flow.name, 'SimpleFlow');
      assert.ok(flow.signature?.includes('AutoLaunchedFlow'));
      assert.equal(flow.isExported, true);
    });

    it('should extract variables as properties', () => {
      const source = readFixture('SimpleFlow.flow-meta.xml');
      const result = parser.parse(source, 'flows/SimpleFlow.flow-meta.xml');

      const vars = result.symbols.filter(s => s.kind === 'property');
      assert.ok(vars.length >= 2, 'Should find at least 2 variables');

      const recordId = vars.find(v => v.name === 'recordId');
      assert.ok(recordId, 'Should find recordId variable');
      assert.equal(recordId.returnType, 'String');
      assert.equal(recordId.parentName, 'SimpleFlow');
    });

    it('should extract decisions as methods', () => {
      const source = readFixture('SimpleFlow.flow-meta.xml');
      const result = parser.parse(source, 'flows/SimpleFlow.flow-meta.xml');

      const decisions = result.symbols.filter(s => s.signature?.includes('Decision'));
      assert.ok(decisions.length >= 1, 'Should find at least 1 decision');
      assert.equal(decisions[0].name, 'Check_Account_Type');
    });

    it('should extract apex actionCalls as calls relationships', () => {
      const source = readFixture('SimpleFlow.flow-meta.xml');
      const result = parser.parse(source, 'flows/SimpleFlow.flow-meta.xml');

      const callsRels = result.relationships.filter(r => r.kind === 'calls');
      assert.ok(callsRels.length >= 1, 'Should find apex action call');
      assert.equal(callsRels[0].targetSymbol, 'AccountUpdateAction');
    });

    it('should extract record operations as uses relationships', () => {
      const source = readFixture('SimpleFlow.flow-meta.xml');
      const result = parser.parse(source, 'flows/SimpleFlow.flow-meta.xml');

      const usesRels = result.relationships.filter(r => r.kind === 'uses');
      assert.ok(usesRels.length >= 2, 'Should find record operations');

      const accountLookup = usesRels.find(r => r.targetSymbol === 'Account');
      assert.ok(accountLookup, 'Should find Account lookup');

      const contactUpdate = usesRels.find(r => r.targetSymbol === 'Contact');
      assert.ok(contactUpdate, 'Should find Contact update');
    });
  });

  describe('parse — CustomObject.object-meta.xml', () => {
    it('should extract object as class symbol', () => {
      const source = readFixture('CustomObject.object-meta.xml');
      const result = parser.parse(source, 'objects/MyObject__c/MyObject__c.object-meta.xml');

      const obj = result.symbols.find(s => s.kind === 'class');
      assert.ok(obj, 'Should find object symbol');
      assert.equal(obj.name, 'MyObject__c');
      assert.ok(obj.modifiers?.includes('custom-object'));
    });

    it('should extract fields as properties', () => {
      const source = readFixture('CustomObject.object-meta.xml');
      const result = parser.parse(source, 'objects/MyObject__c/MyObject__c.object-meta.xml');

      const fields = result.symbols.filter(s => s.kind === 'property');
      assert.ok(fields.length >= 3, 'Should find at least 3 fields');

      const statusField = fields.find(f => f.name === 'Status__c');
      assert.ok(statusField, 'Should find Status__c field');
      assert.equal(statusField.returnType, 'Picklist');
    });

    it('should extract Lookup/MasterDetail as uses relationships', () => {
      const source = readFixture('CustomObject.object-meta.xml');
      const result = parser.parse(source, 'objects/MyObject__c/MyObject__c.object-meta.xml');

      const usesRels = result.relationships.filter(r => r.kind === 'uses');
      assert.ok(usesRels.length >= 2, 'Should find lookup relationships');

      const accountRef = usesRels.find(r => r.targetSymbol === 'Account');
      assert.ok(accountRef, 'Should find Account reference');

      const parentRef = usesRels.find(r => r.targetSymbol === 'ParentObject__c');
      assert.ok(parentRef, 'Should find ParentObject__c reference');
    });

    it('should extract validation rules as methods', () => {
      const source = readFixture('CustomObject.object-meta.xml');
      const result = parser.parse(source, 'objects/MyObject__c/MyObject__c.object-meta.xml');

      const rules = result.symbols.filter(s => s.signature?.includes('ValidationRule'));
      assert.ok(rules.length >= 1, 'Should find validation rule');
      assert.equal(rules[0].name, 'Status_Required');
    });
  });

  describe('parse — LookupField.field-meta.xml', () => {
    it('should extract standalone field', () => {
      const source = readFixture('LookupField.field-meta.xml');
      const result = parser.parse(source, 'force-app/main/default/objects/Case/fields/LookupField.field-meta.xml');

      const field = result.symbols.find(s => s.kind === 'property');
      assert.ok(field, 'Should find field symbol');
      assert.equal(field.name, 'LookupField');
      assert.equal(field.returnType, 'Lookup');
    });

    it('should infer parent object from path', () => {
      const source = readFixture('LookupField.field-meta.xml');
      const result = parser.parse(source, 'force-app/main/default/objects/Case/fields/LookupField.field-meta.xml');

      const field = result.symbols.find(s => s.kind === 'property');
      assert.equal(field?.parentName, 'Case');
    });

    it('should create uses relationship for Lookup field', () => {
      const source = readFixture('LookupField.field-meta.xml');
      const result = parser.parse(source, 'force-app/main/default/objects/Case/fields/LookupField.field-meta.xml');

      const usesRels = result.relationships.filter(r => r.kind === 'uses');
      assert.ok(usesRels.length >= 1, 'Should find uses relationship');
      assert.equal(usesRels[0].sourceSymbol, 'Case');
      assert.equal(usesRels[0].targetSymbol, 'Account');
    });
  });

  describe('parse — LWCMeta.js-meta.xml', () => {
    it('should extract LWC component', () => {
      const source = readFixture('LWCMeta.js-meta.xml');
      const result = parser.parse(source, 'force-app/main/default/lwc/LWCMeta/LWCMeta.js-meta.xml');

      const component = result.symbols.find(s => s.kind === 'class');
      assert.ok(component, 'Should find LWC component');
      assert.equal(component.name, 'LWCMeta');
      assert.ok(component.signature?.includes('LWC'));
      assert.ok(component.modifiers?.includes('exposed'));
      assert.equal(component.isExported, true);
    });
  });

  describe('parse — malformed XML', () => {
    it('should return error without crashing', () => {
      const malformed = '<broken><unclosed>';
      const result = parser.parse(malformed, 'test.flow-meta.xml');

      // Should not crash, may have empty results or errors
      assert.ok(result, 'Should return a result');
      assert.ok(Array.isArray(result.symbols));
      assert.ok(Array.isArray(result.relationships));
      assert.ok(Array.isArray(result.errors));
    });
  });

  describe('parse — empty file', () => {
    it('should handle empty source gracefully', () => {
      const result = parser.parse('', 'empty.flow-meta.xml');
      assert.ok(result, 'Should return a result');
      assert.equal(result.errors.length, 0);
    });
  });
});
