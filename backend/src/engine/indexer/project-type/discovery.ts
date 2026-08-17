/**
 * SA4E-108 — LLMDiscoveryService.
 * Async, non-blocking discovery for unknown project types (BR-14).
 * Triggered when fallback activates. Rate-limited (BR-11).
 */
import type { Logger } from 'pino';
import { ProjectTypeConfigSchema } from './models.js';
import type { ProjectTypeCache } from './cache.js';

/** LLM provider interface */
export interface LLMProvider {
  complete(prompt: string, opts: { timeout: number }): Promise<string>;
}

/** KB ingest function signature */
export type KBIngestFn = (content: string, opts: { type: string; tags: string; scope?: string }) => Promise<void>;
/** KB search function for dedup check */
export type KBSearchFn = (query: string, opts: { type: string; limit: number }) => Promise<{ content: string }[]>;

const PROMPT_TEMPLATE = `You are analyzing a workspace to identify its project type.

Files at root (first 50):
{file_list}

Return ONLY valid JSON matching this schema:
{"type_id":"short-id","display_name":"Name","signals":[{"file":"build_file","confidence":0.9}],"source_roots":["src/"],"test_roots":["test/"],"exclude_patterns":["build/"],"extensions":[".ext"],"priority":5}

Rules: type_id lowercase+hyphens, >=1 signal with confidence>=0.7. If unsure return: null`;

/** Async LLM discovery. Fire-and-forget, never blocks indexing. */
export class LLMDiscoveryService {
  constructor(
    private readonly llm: LLMProvider,
    private readonly kbIngest: KBIngestFn,
    private readonly kbSearch: KBSearchFn,
    private readonly cache: ProjectTypeCache,
    private readonly logger: Logger,
  ) {}

  /** Trigger async discovery. Non-blocking (BR-14). */
  async discoverAsync(workspacePath: string, files: string[]): Promise<void> {
    if (!await this.cache.canDiscover(workspacePath)) {
      this.logger.debug({ workspacePath }, 'Discovery rate-limited');
      return;
    }
    setImmediate(() => this.runDiscovery(workspacePath, files));
  }

  private async runDiscovery(workspacePath: string, files: string[]): Promise<void> {
    try {
      const prompt = this.buildPrompt(files);
      const response = await this.llm.complete(prompt, { timeout: 30_000 });
      const trimmed = response.trim();

      // LLM can't determine → no action
      if (trimmed === 'null') {
        this.logger.info({ workspacePath }, 'LLM unable to determine type');
        await this.cache.markDiscovered(workspacePath);
        return;
      }

      // Validate schema (BR-12)
      const parsed = ProjectTypeConfigSchema.safeParse(JSON.parse(trimmed));
      if (!parsed.success) {
        this.logger.warn({ errors: parsed.error.issues }, 'Invalid LLM schema');
        return;
      }

      const config = { ...parsed.data, auto_discovered: true };

      // Confidence floor check
      if (!config.signals.some(s => s.confidence >= 0.7)) {
        this.logger.warn({ type_id: config.type_id }, 'No signal >= 0.7');
        return;
      }

      // Dedup
      const existing = await this.kbSearch(`project-type-config ${config.type_id}`, { type: 'ARCHITECTURE', limit: 1 });
      if (existing.length > 0) {
        this.logger.info({ type_id: config.type_id }, 'Type exists — skip');
        await this.cache.markDiscovered(workspacePath);
        return;
      }

      // Ingest (BR-13: auto_discovered flag)
      await this.kbIngest(JSON.stringify(config), {
        type: 'ARCHITECTURE',
        tags: `project-type-config,${config.type_id},auto-discovered`,
        scope: 'PROJECT',
      });
      await this.cache.markDiscovered(workspacePath);
      this.logger.info({ type_id: config.type_id }, '🔍 Discovered new project type');
    } catch (err) {
      this.logger.warn({ err, workspacePath }, 'LLM discovery failed');
    }
  }

  /** Build prompt with sanitized filenames (security) */
  private buildPrompt(files: string[]): string {
    const safe = files.slice(0, 50).map(f => f.replace(/[^\w./-]/g, '_').slice(0, 100));
    return PROMPT_TEMPLATE.replace('{file_list}', safe.join('\n'));
  }
}
