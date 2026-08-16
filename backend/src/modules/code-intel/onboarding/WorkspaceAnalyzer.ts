/**
 * SA4E-166 — WorkspaceAnalyzer: Gathers codebase metadata for onboarding.
 * Scans workspace for package.json, tsconfig, directories, and key files.
 * Pure static analysis — no LLM calls.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Logger } from 'pino';
import type { ModuleInfo, PackageMetadata } from './models.js';

/** Directories to skip during workspace scan */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.code-intel',
  'coverage', '.next', '.nuxt', '__pycache__', '.venv',
]);

/** Known entry point filenames */
const ENTRY_POINTS = [
  'src/index.ts', 'src/main.ts', 'src/app.ts', 'src/server.ts',
  'index.ts', 'main.ts', 'app.ts', 'server.ts',
];

export class WorkspaceAnalyzer {
  constructor(
    private readonly workspace: string,
    private readonly logger: Logger,
  ) {}

  /** Read and parse package.json if it exists */
  readPackageJson(): PackageMetadata | null {
    const pkgPath = path.join(this.workspace, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return {
        name: raw.name || 'unknown',
        description: raw.description || '',
        scripts: raw.scripts || {},
        dependencies: raw.dependencies || {},
        devDependencies: raw.devDependencies || {},
      };
    } catch (err) {
      this.logger.warn({ err }, 'Failed to parse package.json');
      return null;
    }
  }

  /** Detect entry point files that exist in workspace */
  detectEntryPoints(): string[] {
    return ENTRY_POINTS.filter((ep) =>
      fs.existsSync(path.join(this.workspace, ep)),
    );
  }

  /** List top-level source directories as modules */
  discoverModules(): ModuleInfo[] {
    const srcDir = path.join(this.workspace, 'src');
    const baseDir = fs.existsSync(srcDir) ? srcDir : this.workspace;
    return this.listModuleDirs(baseDir);
  }

  /** Detect tech stack from config files */
  detectTechStack(): string[] {
    const stack: string[] = [];
    const checks: [string, string][] = [
      ['tsconfig.json', 'TypeScript'],
      ['package.json', 'Node.js'],
      ['docker-compose.yml', 'Docker'],
      ['Dockerfile', 'Docker'],
      ['.eslintrc.json', 'ESLint'],
      ['vitest.config.ts', 'Vitest'],
      ['jest.config.ts', 'Jest'],
      ['webpack.config.js', 'Webpack'],
      ['vite.config.ts', 'Vite'],
      ['pyproject.toml', 'Python'],
      ['Cargo.toml', 'Rust'],
      ['go.mod', 'Go'],
    ];
    for (const [file, tech] of checks) {
      if (fs.existsSync(path.join(this.workspace, file))) {
        stack.push(tech);
      }
    }
    return [...new Set(stack)];
  }

  /** List all source files for cache hash computation */
  listSourceFiles(): string[] {
    const files: string[] = [];
    this.walkDir(this.workspace, files, 3);
    return files.sort();
  }

  private listModuleDirs(baseDir: string): ModuleInfo[] {
    if (!fs.existsSync(baseDir)) return [];
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name))
      .slice(0, 20) // Cap at 20 modules for readability
      .map((e) => this.buildModuleInfo(baseDir, e.name));
  }

  private buildModuleInfo(baseDir: string, name: string): ModuleInfo {
    const modulePath = path.relative(this.workspace, path.join(baseDir, name));
    const indexFile = this.findIndexFile(path.join(baseDir, name));
    const exports = indexFile ? this.extractExports(indexFile) : [];
    return {
      name,
      path: modulePath,
      description: this.inferDescription(name),
      exports: exports.slice(0, 10),
    };
  }

  private findIndexFile(dir: string): string | null {
    const candidates = ['index.ts', 'index.js', 'mod.ts'];
    for (const c of candidates) {
      const full = path.join(dir, c);
      if (fs.existsSync(full)) return full;
    }
    return null;
  }

  private extractExports(filePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const regex = /export\s+(?:class|function|const|interface|type)\s+(\w+)/g;
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        matches.push(m[1]);
      }
      return matches;
    } catch {
      return [];
    }
  }

  private inferDescription(name: string): string {
    const descriptions: Record<string, string> = {
      server: 'HTTP/MCP server layer',
      modules: 'Business logic modules',
      shared: 'Shared types and utilities',
      types: 'TypeScript type definitions',
      config: 'Configuration management',
      engine: 'Core processing engine',
      database: 'Database adapters and queries',
      di: 'Dependency injection container',
      components: 'UI components',
      pages: 'Page controllers',
      utils: 'Utility functions',
      api: 'API client layer',
      services: 'Service layer',
    };
    return descriptions[name.toLowerCase()] || `${name} module`;
  }

  private walkDir(dir: string, acc: string[], depth: number): void {
    if (depth <= 0) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isFile()) {
          acc.push(path.relative(this.workspace, full));
        } else if (entry.isDirectory()) {
          this.walkDir(full, acc, depth - 1);
        }
      }
    } catch {
      // Permission errors — skip silently
    }
  }
}
