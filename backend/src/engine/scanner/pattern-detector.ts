/**
 * Pattern Detector — Identifies DI style, error handling, naming, logging, testing patterns.
 * Ported from: .analysis/code-intelligence/scripts/nodejs/src/full-indexer.ts
 */

import type { ExtractedSymbol } from './signature-extractor.js';

export interface DetectedPatterns {
  diStyle: string;
  errorHandling: string;
  naming: string;
  logging: string;
  testing: string;
}

/** Detect all coding patterns from aggregated module data. */
export function detectPatterns(
  classes: ExtractedSymbol[],
  functions: ExtractedSymbol[],
  imports: string[]
): DetectedPatterns {
  return {
    diStyle: detectDiStyle(classes, functions, imports),
    errorHandling: detectErrorHandling(classes, imports),
    naming: detectNaming(classes),
    logging: detectLogging(imports),
    testing: detectTesting(imports),
  };
}

/** Infer module purpose from name, classes, and packages. */
export function inferModulePurpose(
  moduleName: string,
  classes: ExtractedSymbol[],
  packages: string[]
): string {
  const allNames = [moduleName, ...classes.map(c => c.name), ...packages]
    .join(' ').toLowerCase();
  const purposes: [string, string][] = [
    ['api', 'API layer'], ['controller', 'API layer'],
    ['service', 'Business logic'], ['business', 'Business logic'],
    ['repository', 'Data access'], ['dao', 'Data access'],
    ['data', 'Data access'],
    ['config', 'Configuration'], ['configuration', 'Configuration'],
    ['common', 'Shared utilities'], ['shared', 'Shared utilities'],
    ['test', 'Testing'], ['spec', 'Testing'],
    ['web', 'Web/UI layer'], ['ui', 'Web/UI layer'],
    ['model', 'Domain model'], ['domain', 'Domain model'],
  ];
  for (const [keyword, purpose] of purposes) {
    if (allNames.includes(keyword)) return purpose;
  }
  return 'Application module';
}

function detectDiStyle(
  classes: ExtractedSymbol[],
  functions: ExtractedSymbol[],
  imports: string[]
): string {
  const allText = imports.join(' ');
  if (allText.includes('@Inject') || allText.includes('@Autowired')) {
    return 'field injection';
  }
  if (functions.some(f => f.name === 'constructor' || f.name === '__init__')) {
    return 'constructor injection';
  }
  return 'none';
}

function detectErrorHandling(
  classes: ExtractedSymbol[], imports: string[]
): string {
  const allText = [...imports, ...classes.map(c => c.name)].join(' ');
  if (allText.includes('Result') || allText.includes('Either')) {
    return 'Result type';
  }
  if (allText.includes('ExceptionHandler') || allText.includes('ControllerAdvice')) {
    return 'exception handler';
  }
  if (allText.includes('Exception') || allText.includes('Error')) {
    return 'try-catch';
  }
  return 'unknown';
}

function detectNaming(classes: ExtractedSymbol[]): string {
  const suffixes = ['Controller', 'Service', 'Repository'];
  const found = suffixes.filter(
    suffix => classes.some(c => c.name.endsWith(suffix))
  ).map(s => `*${s}`);
  return found.length > 0 ? found.join(', ') : 'unknown';
}

function detectLogging(imports: string[]): string {
  const allImports = imports.join(' ');
  if (allImports.includes('slf4j') || allImports.includes('SLF4J')) return 'SLF4J';
  if (allImports.includes('log4j') || allImports.includes('Log4j')) return 'Log4j';
  if (allImports.includes('logging')) return 'logging';
  if (allImports.includes('console')) return 'console.log';
  return 'unknown';
}

function detectTesting(imports: string[]): string {
  const allImports = imports.join(' ');
  if (allImports.includes('junit') || allImports.includes('org.junit')) return 'JUnit';
  if (allImports.includes('pytest') || allImports.includes('unittest')) return 'pytest';
  if (allImports.includes('jest') || allImports.includes('@jest')) return 'Jest';
  if (allImports.includes('kotest')) return 'kotest';
  if (allImports.includes('vitest')) return 'vitest';
  return 'unknown';
}
