/**
 * SA4E-166 — OnboardingService: Orchestrates onboarding document generation.
 * Coordinates WorkspaceAnalyzer + MarkdownGenerator with cache validation.
 * BR-1101: Generation < 60 seconds. BR-1102: Cache valid until >20% files change.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Logger } from 'pino';
import type { IOnboardingService, OnboardingResult, CacheState } from './models.js';
import { WorkspaceAnalyzer } from './WorkspaceAnalyzer.js';
import { MarkdownGenerator } from './MarkdownGenerator.js';

/** Threshold for cache invalidation: 20% file change */
const CHANGE_THRESHOLD = 0.2;

export class OnboardingService implements IOnboardingService {
  private readonly analyzer: WorkspaceAnalyzer;
  private readonly generator: MarkdownGenerator;
  private readonly cachePath: string;
  private readonly outputPath: string;

  constructor(
    private readonly workspace: string,
    private readonly logger: Logger,
  ) {
    this.analyzer = new WorkspaceAnalyzer(workspace, logger);
    this.generator = new MarkdownGenerator();
    const codeIntelDir = path.join(workspace, '.code-intel');
    this.cachePath = path.join(codeIntelDir, 'onboarding-cache.json');
    this.outputPath = path.join(codeIntelDir, 'ONBOARDING.md');
  }

  /** Generate onboarding document, using cache when valid */
  async generate(force = false): Promise<OnboardingResult> {
    if (!force && this.isCacheValid()) {
      return this.returnCached();
    }
    return this.generateFresh();
  }

  private isCacheValid(): boolean {
    const cache = this.readCache();
    if (!cache) return false;
    if (!fs.existsSync(this.outputPath)) return false;

    const currentFiles = this.analyzer.listSourceFiles();
    const currentHash = this.computeHash(currentFiles);
    if (currentHash === cache.fileListHash) return true;

    // BR-1102: Check if >20% files changed
    const changeRatio = this.computeChangeRatio(cache, currentFiles);
    return changeRatio <= CHANGE_THRESHOLD;
  }

  private computeChangeRatio(cache: CacheState, current: string[]): number {
    const diff = Math.abs(current.length - cache.fileCount);
    const base = Math.max(cache.fileCount, 1);
    return diff / base;
  }

  private returnCached(): OnboardingResult {
    const content = fs.readFileSync(this.outputPath, 'utf-8');
    const cache = this.readCache()!;
    this.logger.info('Returning cached onboarding document');
    return { content, cached: true, generatedAt: cache.generatedAt };
  }

  private generateFresh(): OnboardingResult {
    this.logger.info('Generating fresh onboarding document');
    const packageMeta = this.analyzer.readPackageJson();
    const techStack = this.analyzer.detectTechStack();
    const entryPoints = this.analyzer.detectEntryPoints();
    const modules = this.analyzer.discoverModules();

    const content = this.generator.generate({
      packageMeta, techStack, entryPoints, modules,
    });

    this.writeOutput(content);
    this.writeCache();
    const generatedAt = new Date().toISOString();
    return { content, cached: false, generatedAt };
  }

  private writeOutput(content: string): void {
    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.outputPath, content, 'utf-8');
  }

  private writeCache(): void {
    const files = this.analyzer.listSourceFiles();
    const state: CacheState = {
      fileListHash: this.computeHash(files),
      fileCount: files.length,
      generatedAt: new Date().toISOString(),
    };
    const dir = path.dirname(this.cachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.cachePath, JSON.stringify(state), 'utf-8');
  }

  private readCache(): CacheState | null {
    if (!fs.existsSync(this.cachePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private computeHash(files: string[]): string {
    return crypto.createHash('sha256')
      .update(files.join('\n'))
      .digest('hex');
  }
}
