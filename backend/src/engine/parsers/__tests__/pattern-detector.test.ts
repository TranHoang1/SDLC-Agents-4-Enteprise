/**
 * SA4E — Unit tests for scanner pattern detection (DI style, error handling,
 * naming, logging, testing) and module-purpose inference.
 */

import { describe, it, expect } from 'vitest';
import { detectPatterns, inferModulePurpose } from '../pattern-detector.js';
import type { ExtractedSymbol } from '../signature-extractor.js';

function sym(name: string, kind: ExtractedSymbol['kind'] = 'class'): ExtractedSymbol {
  return { name, kind, signature: '', startLine: 1, endLine: 1, parentSymbol: null, visibility: null, docComment: null };
}

describe('detectPatterns', () => {
  it('detects field injection from @Inject/@Autowired imports', () => {
    expect(detectPatterns([], [], ['@Inject']).diStyle).toBe('field injection');
    expect(detectPatterns([], [], ['@Autowired', 'spring']).diStyle).toBe('field injection');
  });

  it('detects constructor injection from constructor/__init__ functions', () => {
    const funcs = [sym('constructor', 'function'), sym('go', 'function')];
    expect(detectPatterns([], funcs, []).diStyle).toBe('constructor injection');
    expect(detectPatterns([], [sym('__init__', 'function')], []).diStyle).toBe('constructor injection');
  });

  it('returns none when no DI evidence exists', () => {
    expect(detectPatterns([], [], []).diStyle).toBe('none');
  });

  it('detects error handling styles with priority Result > handler > try-catch', () => {
    const result = detectPatterns([], [], ['Result']);
    expect(result.errorHandling).toBe('Result type');
    expect(detectPatterns([], [], ['Either']).errorHandling).toBe('Result type');

    const handler = detectPatterns([], [], ['ExceptionHandler']);
    expect(handler.errorHandling).toBe('exception handler');
    expect(detectPatterns([], [], ['ControllerAdvice']).errorHandling).toBe('exception handler');

    expect(detectPatterns([], [], ['Exception']).errorHandling).toBe('try-catch');
    expect(detectPatterns([], [], ['SomeError']).errorHandling).toBe('try-catch');
  });

  it('detects try-catch from class names too', () => {
    const classes = [sym('AppException')];
    expect(detectPatterns(classes, [], []).errorHandling).toBe('try-catch');
  });

  it('returns unknown error handling when no evidence', () => {
    expect(detectPatterns([], [], []).errorHandling).toBe('unknown');
  });

  it('detects naming suffixes from class names', () => {
    expect(detectPatterns([sym('UserController')], [] as ExtractedSymbol[], []).naming).toBe('*Controller');
    expect(detectPatterns([sym('OrderService')], [] as ExtractedSymbol[], []).naming).toBe('*Service');
    expect(detectPatterns([sym('UserRepository')], [] as ExtractedSymbol[], []).naming).toBe('*Repository');
    expect(detectPatterns([sym('Widget')], [] as ExtractedSymbol[], []).naming).toBe('unknown');
  });

  it('joins multiple naming suffixes', () => {
    const classes = [sym('UserController'), sym('OrderService'), sym('Repo')];
    expect(detectPatterns(classes, [] as ExtractedSymbol[], []).naming).toBe('*Controller, *Service');
  });

  it('detects logging framework imports with priority SLF4J > Log4j > logging > console', () => {
    expect(detectPatterns([], [], ['org.slf4j']).logging).toBe('SLF4J');
    expect(detectPatterns([], [], ['org.apache.log4j']).logging).toBe('Log4j');
    expect(detectPatterns([], [], ['python logging']).logging).toBe('logging');
    expect(detectPatterns([], [], ['console']).logging).toBe('console.log');
    expect(detectPatterns([], [], ['rabbitmq']).logging).toBe('unknown');
  });

  it('detects testing framework imports', () => {
    expect(detectPatterns([], [], ['org.junit.Test']).testing).toBe('JUnit');
    expect(detectPatterns([], [], ['import pytest']).testing).toBe('pytest');
    expect(detectPatterns([], [], ['@jest/globals']).testing).toBe('Jest');
    expect(detectPatterns([], [], ['io.kotest']).testing).toBe('kotest');
    expect(detectPatterns([], [], ['vitest']).testing).toBe('vitest');
    expect(detectPatterns([], [], []).testing).toBe('unknown');
  });
});

describe('inferModulePurpose', () => {
  const cases: Array<[string, string]> = [
    ['user-api', 'API layer'],
    ['controller', 'API layer'],
    ['auth-service', 'Business logic'],
    ['business', 'Business logic'],
    ['user-repository', 'Data access'],
    ['dao', 'Data access'],
    ['data-mapper', 'Data access'],
    ['app-config', 'Configuration'],
    ['common-utils', 'Shared utilities'],
    ['shared', 'Shared utilities'],
    ['test-helpers', 'Testing'],
    ['spec-runner', 'Testing'],
    ['web-client', 'Web/UI layer'],
    ['ui-components', 'Web/UI layer'],
    ['user-model', 'Domain model'],
    ['domain-events', 'Domain model'],
  ];

  for (const [name, expected] of cases) {
    it(`maps ${name} to ${expected}`, () => {
      expect(inferModulePurpose(name, [], [])).toBe(expected);
    });
  }

  it('considers class names and packages alongside the module name', () => {
    expect(inferModulePurpose('orders', [sym('OrderController')], [])).toBe('API layer');
    expect(inferModulePurpose('orders', [], ['spring-web'])).toBe('Web/UI layer');
  });

  it('falls back to Application module', () => {
    expect(inferModulePurpose('misc', [], [])).toBe('Application module');
  });
});