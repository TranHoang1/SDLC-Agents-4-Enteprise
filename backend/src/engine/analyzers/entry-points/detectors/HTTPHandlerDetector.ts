/**
 * KSA-162: HTTP Handler Detector — Detects HTTP route handlers.
 */

import type { EntryPoint, FrameworkPatterns } from '../types.js';
import { PatternRegistry } from '../PatternRegistry.js';
import { RouteResolver } from '../RouteResolver.js';

interface SymbolInput {
  id: number;
  name: string;
  decorators?: string[];
  parentName?: string | null;
  filePath: string;
  startLine: number;
}

export class HTTPHandlerDetector {
  private registry: PatternRegistry;
  private routeResolver: RouteResolver;

  constructor(registry: PatternRegistry) {
    this.registry = registry;
    this.routeResolver = new RouteResolver();
  }

  /** Detect HTTP handlers from symbols and source. */
  detectFromSymbols(symbols: SymbolInput[], framework: string, source: string): EntryPoint[] {
    const patterns = this.registry.getFramework(framework);
    if (!patterns) return [];

    const results: EntryPoint[] = [];
    const controllerPrefix = this.findControllerPrefix(symbols, patterns);

    for (const sym of symbols) {
      const detected = this.detectHandler(sym, framework, patterns, controllerPrefix, source);
      if (detected) results.push(detected);
    }
    return results;
  }

  private detectHandler(
    sym: SymbolInput, framework: string, patterns: FrameworkPatterns,
    controllerPrefix: string | null, source: string
  ): EntryPoint | null {
    const decorators = sym.decorators ?? [];

    // Decorator-based detection (NestJS, Spring, FastAPI)
    if (patterns.decorators) {
      for (const handlerPattern of patterns.decorators.handler) {
        const matchingDec = decorators.find(d => d.includes(handlerPattern));
        if (matchingDec) {
          const { method, path } = this.extractMethodAndPath(matchingDec, handlerPattern);
          const fullRoute = this.routeResolver.resolve(controllerPrefix, path);
          const hasAuth = this.hasAuthIndicator(decorators, patterns);

          return {
            symbol_id: sym.id, symbol_name: sym.name,
            file_path: sym.filePath, start_line: sym.startLine,
            entry_type: 'HTTP_HANDLER', framework,
            http_method: method, route_path: path,
            full_route: this.routeResolver.normalizeParams(fullRoute),
            middleware: this.detectMiddleware(decorators),
            has_auth: hasAuth, controller: sym.parentName ?? null,
            event_name: null, confidence: 'High',
          };
        }
      }
    }

    // Call-pattern-based detection (Express, Ktor, Gin)
    if (patterns.call_patterns) {
      const symContext = this.getSymbolContext(source, sym.startLine);
      for (const handlerPattern of patterns.call_patterns.handler) {
        if (symContext.includes(handlerPattern)) {
          const method = this.extractMethodFromCall(handlerPattern);
          const path = this.extractPathFromContext(symContext, handlerPattern);
          const fullRoute = this.routeResolver.resolve(controllerPrefix, path);

          return {
            symbol_id: sym.id, symbol_name: sym.name,
            file_path: sym.filePath, start_line: sym.startLine,
            entry_type: 'HTTP_HANDLER', framework,
            http_method: method, route_path: path,
            full_route: this.routeResolver.normalizeParams(fullRoute),
            middleware: [], has_auth: false, controller: null,
            event_name: null, confidence: 'Medium',
          };
        }
      }
    }

    return null;
  }

  private findControllerPrefix(symbols: SymbolInput[], patterns: FrameworkPatterns): string | null {
    if (!patterns.decorators?.prefix) return null;
    for (const prefixPattern of patterns.decorators.prefix) {
      for (const sym of symbols) {
        const match = (sym.decorators ?? []).find(d => d.includes(prefixPattern));
        if (match) return this.extractPathArg(match);
      }
    }
    return null;
  }

  private extractMethodAndPath(decorator: string, pattern: string): { method: string; path: string } {
    const lower = pattern.toLowerCase();
    let method = 'GET';
    if (lower.includes('post')) method = 'POST';
    else if (lower.includes('put')) method = 'PUT';
    else if (lower.includes('delete')) method = 'DELETE';
    else if (lower.includes('patch')) method = 'PATCH';
    const path = this.extractPathArg(decorator);
    return { method, path };
  }

  private extractPathArg(text: string): string {
    const match = text.match(/['"`]([^'"`]*)['"`]/);
    if (match) return this.routeResolver.extractPathFromArg(match[1]);
    return '/';
  }

  private extractMethodFromCall(pattern: string): string {
    const p = pattern.toLowerCase();
    if (p.includes('post')) return 'POST';
    if (p.includes('put')) return 'PUT';
    if (p.includes('delete')) return 'DELETE';
    if (p.includes('patch')) return 'PATCH';
    return 'GET';
  }

  private extractPathFromContext(context: string, pattern: string): string {
    const idx = context.indexOf(pattern);
    if (idx === -1) return '/';
    const after = context.slice(idx + pattern.length);
    const match = after.match(/['"`]([^'"`]*)['"`]/);
    return match ? this.routeResolver.extractPathFromArg(match[1]) : '/';
  }

  private getSymbolContext(source: string, startLine: number): string {
    const lines = source.split('\n');
    const start = Math.max(0, startLine - 3);
    const end = Math.min(lines.length, startLine + 5);
    return lines.slice(start, end).join('\n');
  }

  private detectMiddleware(decorators: string[]): string[] {
    return decorators.filter(d => d.includes('UseGuards') || d.includes('Middleware'));
  }

  private hasAuthIndicator(decorators: string[], patterns: FrameworkPatterns): boolean {
    for (const indicator of patterns.auth_indicators) {
      if (decorators.some(d => d.includes(indicator))) return true;
    }
    return false;
  }
}
