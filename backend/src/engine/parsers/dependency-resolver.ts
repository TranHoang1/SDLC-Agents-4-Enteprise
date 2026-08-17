/**
 * SA4E-78 — DependencyResolver (static-only, no filesystem access).
 * Resolves import/require statements to candidate file paths.
 * Hash verification is deferred to when content is available via the indexer.
 */

import type { FileDependency } from './types.js';
import * as path from 'path';
import { PegaRuleAstParser } from '../../modules/pega/PegaRuleAstParser.js';

const AST_PARSER = new PegaRuleAstParser();

export class DependencyResolver {
  resolve(source: string, filePath: string, workspace: string): FileDependency[] {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
      return this.resolveTsJs(source, filePath, workspace);
    }
    if (ext === '.java') {
      return this.resolveJava(source, filePath, workspace);
    }
    if (ext === '.py') {
      return this.resolvePython(source, filePath, workspace);
    }
    if (ext === '.pega') {
      return this.resolvePega(source, filePath, workspace);
    }
    return [];
  }

  /**
   * Static TS/JS import resolution — compute candidate path without reading files.
   * Hash verification deferred to indexer (SA4E-78: AD-7).
   */
  private resolveTsJs(source: string, filePath: string, _workspace: string): FileDependency[] {
    const deps: FileDependency[] = [];
    const dir = path.posix.dirname(filePath);
    const importRe = /from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(source)) !== null) {
      const modulePath = match[1] || match[2];
      if (!modulePath || seen.has(modulePath)) continue;
      seen.add(modulePath);
      if (modulePath.startsWith('.')) {
        // Static resolution: compute candidate path, no file read
        const candidate = path.posix.resolve(dir, modulePath);
        deps.push({ path: candidate, expectedHash: '', sourceType: 'local' });
      }
    }
    return deps;
  }

  private resolveJava(source: string, _filePath: string, _workspace: string): FileDependency[] {
    const deps: FileDependency[] = [];
    const importRe = /^import\s+(?:static\s+)?([a-zA-Z0-9_.*]+)\s*;/gm;
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(source)) !== null) {
      const importPath = match[1];
      if (!importPath || importPath.includes('*') || seen.has(importPath)) continue;
      seen.add(importPath);
      const fileRelPath = importPath.replace(/\./g, '/') + '.java';
      if (fileRelPath.startsWith('java/') || fileRelPath.startsWith('javax/') || fileRelPath.startsWith('org/springframework/') || fileRelPath.startsWith('com/fasterxml/') || fileRelPath.startsWith('org/apache/') || fileRelPath.startsWith('org/slf4j/') || fileRelPath.startsWith('org/junit/') || fileRelPath.startsWith('org/mockito/') || fileRelPath.startsWith('lombok/')) continue;
      deps.push({
        path: fileRelPath,
        expectedHash: '',
        sourceType: 'local',
      });
    }
    return deps;
  }

  private resolvePython(source: string, filePath: string, _workspace: string): FileDependency[] {
    const deps: FileDependency[] = [];
    const importRe = /^(?:from\s+([a-zA-Z0-9_.]+)\s+)?import\s+([a-zA-Z0-9_* ,]+)/gm;
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(source)) !== null) {
      const fromModule = match[1];
      const modulePath = fromModule || match[2].split(',')[0].trim();
      if (!modulePath || seen.has(modulePath)) continue;
      seen.add(modulePath);
      if (modulePath.startsWith('.')) {
        const parts = filePath.split('/');
        const base = parts.slice(0, -1);
        const levels = modulePath.split('.');
        let rel: string;
        if (levels[0] === '') {
          rel = path.posix.join(...base, ...levels.slice(1).filter(Boolean));
        } else {
          rel = path.posix.join(...base, ...levels.filter(Boolean));
        }
        deps.push({
          path: rel + '.py',
          expectedHash: '',
          sourceType: 'local',
        });
      }
    }
    return deps;
  }

  /**
   * Static Pega reference resolution — parse AST references without file reads.
   * SA4E-78: hash deferred, no filesystem coupling.
   */
  private resolvePega(source: string, _filePath: string, _workspace: string): FileDependency[] {
    const deps: FileDependency[] = [];
    try {
      const json = JSON.parse(source);
      const ast = AST_PARSER.parse(json);
      for (const ref of ast.references) {
        const targetFile = this.pegaRefToFilePath(ref);
        deps.push({ path: targetFile, expectedHash: '', sourceType: 'local' });
      }
    } catch {
      // JSON parse failed — skip
    }
    return deps;
  }

  private pegaRefToFilePath(ref: { ruleType: string; className: string; ruleName: string }): string {
    const typePart = ref.ruleType.replace(/-/g, '-');
    const cls = ref.className.replace(/^@/, '');
    return cls ? `${cls}.${ref.ruleName}.${typePart}.pega` : `${ref.ruleName}.${typePart}.pega`;
  }
}
