/**
 * SA4E-85 — DiagramRenderer (Task 8.1).
 * Local PlantUML CLI rendering to SVG via java -jar plantuml.jar.
 * Bundle impact: 0KB — uses child_process, no npm dependency.
 * LRU cache: max 50 rendered SVGs in memory.
 * Fallback: if Java unavailable, returns undefined (caller shows source).
 */

import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import type { IDiagramRenderer, DiagramBlock, DiagramType } from './types';
import { LruCache } from './LruCache';
import { buildSkinnedSource } from './skinParams';

const execFileAsync = promisify(execFile);

/** Maximum cached SVG entries */
const MAX_CACHE_SIZE = 50;

/** Timeout for PlantUML process (ms) */
const RENDER_TIMEOUT_MS = 15_000;

/**
 * DiagramRenderer — renders PlantUML source to SVG locally.
 * Uses java -jar plantuml.jar -tsvg -pipe for zero SSRF risk.
 * @implements IDiagramRenderer
 */
export class DiagramRenderer implements IDiagramRenderer {
  private readonly cache: LruCache<string, string>;
  private readonly jarPath: string;
  private javaAvailable: boolean | null = null;

  /**
   * @param plantumlJarPath - Absolute path to plantuml.jar
   */
  constructor(plantumlJarPath: string) {
    this.jarPath = plantumlJarPath;
    this.cache = new LruCache<string, string>(MAX_CACHE_SIZE);
  }

  /** Render diagram source to SVG string */
  async render(block: DiagramBlock): Promise<string | undefined> {
    if (!this.supports(block.type)) return undefined;

    const cached = this.cache.get(block.diagramId);
    if (cached) return cached;

    const available = await this.checkJavaAvailable();
    if (!available) return undefined;

    return this.executePlantUml(block);
  }

  /** Check if renderer supports given diagram type */
  supports(type: DiagramType): boolean {
    return type === 'plantuml';
  }

  /** Clear render cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Verify Java runtime is accessible */
  private async checkJavaAvailable(): Promise<boolean> {
    if (this.javaAvailable !== null) return this.javaAvailable;

    try {
      await execFileAsync('java', ['-version'], { timeout: 5000 });
      this.javaAvailable = true;
    } catch {
      this.javaAvailable = false;
    }
    return this.javaAvailable;
  }

  /** Execute plantuml.jar via stdin pipe and capture SVG output */
  private executePlantUml(
    block: DiagramBlock
  ): Promise<string | undefined> {
    const source = buildSkinnedSource(block.source);

    return new Promise((resolve) => {
      const proc = spawn(
        'java',
        ['-jar', this.jarPath, '-tsvg', '-pipe'],
        { timeout: RENDER_TIMEOUT_MS }
      );

      let stdout = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, RENDER_TIMEOUT_MS);

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.on('close', () => {
        clearTimeout(timer);
        if (timedOut || !stdout.includes('<svg')) {
          resolve(undefined);
          return;
        }
        this.cache.set(block.diagramId, stdout);
        resolve(stdout);
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve(undefined);
      });

      proc.stdin.write(source);
      proc.stdin.end();
    });
  }
}
