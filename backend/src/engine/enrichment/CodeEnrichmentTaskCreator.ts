/**
 * SA4E-107: Code Enrichment Task Creator.
 * Creates CODE_ENRICHMENT tasks after indexing. Skips already-enriched symbols.
 * Cross-scope dedup: skips LLM if same content_hash already enriched in another project/scope.
 * Non-blocking: failures don't affect the indexing pipeline (BR-01).
 */

import type { Logger } from 'pino';
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';
import { TaskType, TaskStatus } from '../../modules/memory/task-queue/models.js';
import { isPegaKind } from '../../modules/pega/pega-mapping.js';

/** Kinds eligible for enrichment — excludes trivial symbols like variables. */
const ENRICHABLE_KINDS = new Set([
  'class', 'interface', 'enum',
  'function', 'method', 'arrow_function', 'generator',
]);

/**
 * Creates CODE_ENRICHMENT tasks for newly indexed symbols.
 * Injected into IndexingEngine, called after storeResults().
 */
export class CodeEnrichmentTaskCreator {
  constructor(
    private readonly adapter: DatabaseAdapter,
    private readonly logger: Logger,
  ) {}

  /**
   * Create enrichment tasks for symbols that haven't been enriched yet.
   * Skips if same file content_hash already enriched in another project (cross-scope dedup).
   * @param symbolIds - Map of symbol name to symbol ID from storeResults()
   * @param filePath - Relative file path of indexed file
   * @param projectId - Tenant project ID
   * @returns Number of tasks created
   */
  async createTasks(
    symbolIds: Map<string, number>,
    filePath: string,
    projectId: string,
  ): Promise<number> {
    if (symbolIds.size === 0) return 0;

    // Cross-scope dedup: skip entire file if already enriched in another project
    const enrichedElsewhere = await this.isFileEnrichedInOtherScope(filePath, projectId);
    if (enrichedElsewhere) {
      this.logger.debug({ filePath, projectId }, '[enrichment] Skipped — same hash enriched in another scope');
      return 0;
    }

    let created = 0;
    for (const [symbolName, symbolId] of symbolIds) {
      if (symbolId <= 0) continue;
      const shouldCreate = await this.shouldCreateTask(symbolId);
      if (!shouldCreate) continue;

      const kind = await this.getSymbolKind(symbolId);
      if (!kind || (!ENRICHABLE_KINDS.has(kind) && !isPegaKind(kind))) continue;

      await this.insertTask(symbolId, symbolName, kind, filePath, projectId);
      created++;
    }

    if (created > 0) {
      this.logger.debug({ created, filePath, projectId }, '[enrichment] Tasks created');
    }
    return created;
  }

  /**
   * Create enrichment tasks for all unenriched symbols in a project.
   * Called after full indexing — queries symbols table directly.
   * Cross-scope dedup: skips files whose content_hash is already enriched elsewhere.
   * @param projectId - Tenant project ID
   * @returns Number of tasks created
   */
  async createTasksForProject(projectId: string): Promise<number> {
    const symbols = await this.adapter.allAsync<{ id: number; name: string; kind: string; file_path: string }>(
      `SELECT s.id, s.name, s.kind, f.relative_path as file_path
       FROM symbols s JOIN files f ON s.file_id = f.id
       WHERE s.project_id = ?
         AND (s.enrichment_status IS NULL OR s.enrichment_status = 'FAILED'
              OR (s.enrichment_status = 'COMPLETED' AND s.summary IS NULL))
       LIMIT 500`,
      [projectId],
    );

    // Batch cross-scope check: collect unique file paths, check which are already enriched
    const filePathsToCheck = [...new Set(symbols.map(s => s.file_path))];
    const skippedFiles = new Set<string>();
    for (const fp of filePathsToCheck) {
      if (await this.isFileEnrichedInOtherScope(fp, projectId)) {
        skippedFiles.add(fp);
      }
    }

    if (skippedFiles.size > 0) {
      this.logger.info({ skipped: skippedFiles.size, projectId }, '[enrichment] Files skipped — already enriched in another scope');
    }

    let created = 0;
    for (const sym of symbols) {
      if (!ENRICHABLE_KINDS.has(sym.kind) && !isPegaKind(sym.kind)) continue;
      if (skippedFiles.has(sym.file_path)) continue; // Cross-scope dedup
      await this.insertTask(sym.id, sym.name, sym.kind, sym.file_path, projectId);
      created++;
    }

    if (created > 0) {
      this.logger.info({ created, projectId }, '[enrichment] Batch tasks created for project');
    }
    return created;
  }

  /** Skip if symbol already fully enriched (has summary). */
  private async shouldCreateTask(symbolId: number): Promise<boolean> {
    const row = await this.adapter.getAsync<{ enrichment_status: string | null; summary: string | null }>(
      'SELECT enrichment_status, summary FROM symbols WHERE id = ?',
      [symbolId],
    );
    // Skip only if COMPLETED AND has summary (CODE_ENRICHMENT done, not just TAG_ENRICHMENT)
    return !(row?.enrichment_status === 'COMPLETED' && row?.summary);
  }

  /**
   * Cross-scope dedup: check if the same file (by content_hash) has already been
   * enriched in another project. If yes, skip LLM task creation entirely.
   * The enrichment data remains queryable from the other project's symbols.
   */
  private async isFileEnrichedInOtherScope(filePath: string, currentProjectId: string): Promise<boolean> {
    try {
      // Get the content_hash of this file in the current project
      const currentFile = await this.adapter.getAsync<{ content_hash: string }>(
        'SELECT content_hash FROM files WHERE relative_path = ? AND project_id = ?',
        [filePath, currentProjectId],
      );
      if (!currentFile?.content_hash) return false;

      // Check if same hash exists in another project with at least one enriched symbol
      const enrichedElsewhere = await this.adapter.getAsync<{ id: number }>(
        `SELECT f.id FROM files f
         JOIN symbols s ON s.file_id = f.id
         WHERE f.content_hash = ? AND f.project_id != ?
           AND s.enrichment_status = 'COMPLETED'
         LIMIT 1`,
        [currentFile.content_hash, currentProjectId],
      );
      return !!enrichedElsewhere;
    } catch {
      // Non-fatal: if query fails (table missing, etc.), proceed with task creation
      return false;
    }
  }

  private async getSymbolKind(symbolId: number): Promise<string | null> {
    const row = await this.adapter.getAsync<{ kind: string }>(
      'SELECT kind FROM symbols WHERE id = ?', [symbolId],
    );
    return row?.kind ?? null;
  }

  private async insertTask(
    symbolId: number, symbolName: string, kind: string,
    filePath: string, projectId: string,
  ): Promise<void> {
    // SA4E-171: dynamically set workspaceType based on symbol kind
    const payload = JSON.stringify({
      symbolId, symbolName, symbolKind: kind,
      projectId, filePath,
      workspaceType: isPegaKind(kind) ? 'pega' : 'standard',
    });

    await this.adapter.runAsync(
      `INSERT INTO pending_tasks (task_type, entry_id, status, payload, max_retries, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [TaskType.CODE_ENRICHMENT, symbolId, TaskStatus.PENDING, payload, 3],
    );
  }
}
