import { describe, it, expect, beforeEach } from 'vitest';
import { ArtifactDetector } from '../artifact-analyzer/detector.js';
import { PegaRuleAnalyzer } from '../artifact-analyzer/analyzers/PegaRuleAnalyzer.js';
import { GenericCodeAnalyzer } from '../artifact-analyzer/analyzers/GenericCodeAnalyzer.js';
import { StructureAnalyzer } from '../artifact-analyzer/analyzers/StructureAnalyzer.js';
import { FallbackAnalyzer } from '../artifact-analyzer/analyzers/FallbackAnalyzer.js';
import { ArtifactAnalyzerRegistry } from '../artifact-analyzer/ArtifactAnalyzerRegistry.js';
import type { ArtifactAnalyzer, ArtifactAnalysis, ArtifactType } from '../artifact-analyzer/types.js';

// ─── Fixtures ────────────────────────────────────────────────────────────

const PEGA_RULE_JSON = JSON.stringify({
  pxObjClass: 'Rule-Obj-Activity',
  pyClassName: 'Work-Cover-Jira',
  pyActivityName: 'ResolveTicket',
  pyLabel: 'Process and Resolve Jira Ticket',
  pyRuleset: 'JiraIntegration',
  steps: [
    { pyStepNum: '1', pyMethod: 'Property-Set', pyMethodParameters: '.Status', pyStepPage: '', pyStepPageClass: '' },
    { pyStepNum: '2', pyMethod: 'Call', pyMethodParameters: 'Work-Cover-Jira.SendNotification', pyStepPage: '', pyStepPageClass: '' },
  ],
});

const PEGA_RULE_NO_PXOBJCLASS = JSON.stringify({
  pyClassName: 'Work-Cover-Jira',
  pyActivityName: 'NoClassRule',
});

const TYPESCRIPT_CODE = `import { Component } from '@angular/core';

interface User {
  name: string;
  age: number;
}

export function greet(user: User): string {
  return \`Hello, \${user.name}\`;
}`;

const PYTHON_CODE = `import os
from typing import List

def calculate_total(items: List[float]) -> float:
    total = 0.0
    for item in items:
        total += item
    return total

class Calculator:
    pass`;

const JAVA_CODE = `package com.example;

import java.util.List;

public class HelloWorld {
    private String name;

    public String greet() {
        return "Hello, " + this.name;
    }
}`;

const CPP_CODE = `#include <iostream>
#include <vector>

class MyClass {
private:
    int value;
public:
    MyClass(int v) : value(v) {}
    void print() const { std::cout << value; }
};

int main() {
    MyClass obj(42);
    obj.print();
    return 0;
}`;

const JSON_OBJECT = '{"name": "test", "value": 42, "nested": {"a": 1, "b": 2}}';
const JSON_ARRAY = '[1, 2, 3, {"key": "val"}]';
const XML_CONTENT = '<root><item id="1">value</item><item id="2">other</item></root>';
const YAML_CONTENT = 'server:\n  port: 8080\n  host: localhost\n  debug: true';

const RANDOM_TEXT = 'The quick brown fox jumps over the lazy dog.';

// ─── ArtifactDetector (10 tests) ─────────────────────────────────────────

describe('ArtifactDetector', () => {
  let detector: ArtifactDetector;

  beforeEach(() => {
    detector = new ArtifactDetector();
  });

  // Test 1: Detects pega_rule from pxObjClass
  it('detects pega_rule from pxObjClass', () => {
    expect(detector.detect(PEGA_RULE_JSON)).toBe('pega_rule');
  });

  // Test 2: Detects code from TypeScript import/export
  it('detects code from TypeScript import/export', () => {
    expect(detector.detect(TYPESCRIPT_CODE)).toBe('code');
  });

  // Test 3: Detects code from Python def/import
  it('detects code from Python def/import', () => {
    expect(detector.detect(PYTHON_CODE)).toBe('code');
  });

  // Test 4: Detects code from Java class/import
  it('detects code from Java class/import', () => {
    expect(detector.detect(JAVA_CODE)).toBe('code');
  });

  // Test 5: Detects code from C++ #include
  it('detects code from C++ #include', () => {
    expect(detector.detect(CPP_CODE)).toBe('code');
  });

  // Test 6: Detects structured_data from JSON
  it('detects structured_data from JSON', () => {
    expect(detector.detect(JSON_OBJECT)).toBe('structured_data');
  });

  // Test 7: Detects structured_data from XML
  it('detects structured_data from XML', () => {
    expect(detector.detect(XML_CONTENT)).toBe('structured_data');
  });

  // Test 8: Detects structured_data from YAML
  it('detects structured_data from YAML', () => {
    expect(detector.detect(YAML_CONTENT)).toBe('structured_data');
  });

  // Test 9: Returns unknown for random text
  it('returns unknown for random text', () => {
    expect(detector.detect(RANDOM_TEXT)).toBe('unknown');
  });

  // Test 10: Hint overrides auto-detection
  it('hint overrides auto-detection', () => {
    expect(detector.detect(RANDOM_TEXT, 'code')).toBe('code');
    expect(detector.detect(RANDOM_TEXT, 'pega_rule')).toBe('pega_rule');
    expect(detector.detect(RANDOM_TEXT, 'structured_data')).toBe('structured_data');
  });
});

// ─── PegaRuleAnalyzer (5 tests) ──────────────────────────────────────────

describe('PegaRuleAnalyzer', () => {
  let analyzer: PegaRuleAnalyzer;

  beforeEach(() => {
    analyzer = new PegaRuleAnalyzer();
  });

  // Test 11: canAnalyze returns true for content with pxObjClass
  it('canAnalyze returns true for content with pxObjClass', () => {
    expect(analyzer.canAnalyze(PEGA_RULE_JSON)).toBe(true);
  });

  // Test 12: canAnalyze returns false for content without pxObjClass
  it('canAnalyze returns false for content without pxObjClass', () => {
    expect(analyzer.canAnalyze(PEGA_RULE_NO_PXOBJCLASS)).toBe(false);
  });

  // Test 13: analyze returns correct type 'pega_rule'
  it('analyze returns correct type pega_rule', async () => {
    const result = await analyzer.analyze(PEGA_RULE_JSON);
    expect(result.type).toBe('pega_rule');
  });

  // Test 14: analyze promptContext contains schema section
  it('analyze promptContext contains schema section', async () => {
    const result = await analyzer.analyze(PEGA_RULE_JSON);
    expect(result.promptContext).toContain('Schema');
    expect(result.promptContext).toContain('Rule Type:');
  });

  // Test 15: analyze promptContext contains dependencies section
  it('analyze promptContext contains dependencies section', async () => {
    const result = await analyzer.analyze(PEGA_RULE_JSON);
    expect(result.promptContext).toContain('Dependencies');
  });
});

// ─── GenericCodeAnalyzer (4 tests) ───────────────────────────────────────

describe('GenericCodeAnalyzer', () => {
  let analyzer: GenericCodeAnalyzer;

  beforeEach(() => {
    analyzer = new GenericCodeAnalyzer();
  });

  // Test 16: canAnalyze returns true for TypeScript code
  it('canAnalyze returns true for TypeScript code', () => {
    expect(analyzer.canAnalyze(TYPESCRIPT_CODE)).toBe(true);
  });

  // Test 17: canAnalyze returns true for Python code
  it('canAnalyze returns true for Python code', () => {
    expect(analyzer.canAnalyze(PYTHON_CODE)).toBe(true);
  });

  // Test 18: canAnalyze returns true for Java code
  it('canAnalyze returns true for Java code', () => {
    expect(analyzer.canAnalyze(JAVA_CODE)).toBe(true);
  });

  // Test 19: analyze returns correct type 'code' with line count
  it('analyze returns type code with line count and suggestion to use get_edit_context', () => {
    const result = analyzer.analyze(TYPESCRIPT_CODE);
    expect(result.type).toBe('code');
    expect(result.summary).toContain('lines');
    expect(result.promptContext).toContain('get_edit_context');
    expect(result.details.lines).toBe(TYPESCRIPT_CODE.split('\n').length);
  });
});

// ─── StructureAnalyzer (3 tests) ─────────────────────────────────────────

describe('StructureAnalyzer', () => {
  let analyzer: StructureAnalyzer;

  beforeEach(() => {
    analyzer = new StructureAnalyzer();
  });

  // Test 20: canAnalyze returns true for JSON
  it('canAnalyze returns true for JSON', () => {
    expect(analyzer.canAnalyze(JSON_OBJECT)).toBe(true);
  });

  // Test 21: analyze returns type structured_data with key count
  it('analyze returns type structured_data with key count', () => {
    const result = analyzer.analyze(JSON_OBJECT);
    expect(result.type).toBe('structured_data');
    expect(result.summary).toContain('3 top-level keys');
  });

  // Test 22: analyze promptContext shows JSON schema tree
  it('analyze promptContext shows JSON schema tree', () => {
    const result = analyzer.analyze(JSON_OBJECT);
    expect(result.promptContext).toContain('Schema Tree');
    expect(result.promptContext).toContain('name');
    expect(result.promptContext).toContain('value');
    expect(result.promptContext).toContain('nested');
  });
});

// ─── FallbackAnalyzer (2 tests) ──────────────────────────────────────────

describe('FallbackAnalyzer', () => {
  let analyzer: FallbackAnalyzer;

  beforeEach(() => {
    analyzer = new FallbackAnalyzer();
  });

  // Test 23: canAnalyze always returns true
  it('canAnalyze always returns true', () => {
    expect(analyzer.canAnalyze('')).toBe(true);
    expect(analyzer.canAnalyze(RANDOM_TEXT)).toBe(true);
    expect(analyzer.canAnalyze(TYPESCRIPT_CODE)).toBe(true);
  });

  // Test 24: analyze returns type unknown with line/char counts
  it('analyze returns type unknown with line/char counts', () => {
    const result = analyzer.analyze(RANDOM_TEXT);
    expect(result.type).toBe('unknown');
    expect(result.summary).toContain('lines');
    expect(result.summary).toContain('chars');
    expect(result.details.md5).toBeDefined();
    expect(typeof result.details.md5).toBe('string');
  });
});

// ─── ArtifactAnalyzerRegistry (3 tests) ──────────────────────────────────

describe('ArtifactAnalyzerRegistry', () => {
  let registry: ArtifactAnalyzerRegistry;

  beforeEach(() => {
    registry = new ArtifactAnalyzerRegistry();
  });

  // Test 25: Routes Pega rule to PegaRuleAnalyzer
  it('routes Pega rule to PegaRuleAnalyzer', async () => {
    const result = await registry.analyze(PEGA_RULE_JSON);
    expect(result.type).toBe('pega_rule');
    expect(result.summary).toContain('Pega Rule');
  });

  // Test 26: Routes TypeScript to GenericCodeAnalyzer (code)
  it('routes TypeScript to GenericCodeAnalyzer', async () => {
    const result = await registry.analyze(TYPESCRIPT_CODE);
    expect(result.type).toBe('code');
    expect(result.summary).toContain('Code artifact');
  });

  // Test 27: Routes unknown to FallbackAnalyzer
  it('routes unknown to FallbackAnalyzer', async () => {
    const result = await registry.analyze(RANDOM_TEXT);
    expect(result.type).toBe('unknown');
    expect(result.summary).toContain('Unknown artifact');
    expect(result.detectedBy).toBe('fallback');
  });
});
