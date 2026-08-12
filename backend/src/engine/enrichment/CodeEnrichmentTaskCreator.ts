/**
 * SA4E-107: Code Enrichment Task Creator.
 * Creates CODE_ENRICHMENT tasks after indexing. Skips already-enriched symbols.
 * Non-blocking: failures don't affect the indexing pipeline (BR-01).
 */

import type { Logger } from 'pino';
import type { DatabaseAdapter } from '../../database/adapters/DatabaseAdapter.js';
import { TaskType, TaskStatus } from '../../modules/memory/task-queue/models.js';

/** Kinds eligible for enrichment — excludes trivial symbols like variables. */
const ENRICHABLE_KINDS = new Set([
  'class', 'interface', 'enum',
  'function', 'method', 'arrow_function', 'generator',
  'pega_activity', 'pega_data_transform', 'pega_flow',
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

    let created = 0;
    for (const [symbolName, symbolId] of symbolIds) {
      if (symbolId <= 0) continue;
      const shouldCreate = await this.shouldCreateTask(symbolId);
      if (!shouldCreate) continue;

      const kind = await this.getSymbolKind(symbolId);
      if (!kind || !ENRICHABLE_KINDS.has(kind)) continue;

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
   * @param projectId - Tenant project ID
   * @returns Number of tasks created
   */
  async createTasksForProject(projectId: string): Promise<number> {
    const symbols = await this.adapter.allAsync<{ id: number; name: string; kind: string; file_path: string }>(
      `SELECT s.id, s.name, s.kind, f.relative_path as file_path
       FROM symbols s JOIN files f ON s.file_id = f.id
       WHERE s.project_id = ? AND (s.enrichment_status IS NULL OR s.enrichment_status = 'FAILED')
       LIMIT 500`,
      [projectId],
    );

    let created = 0;
    for (const sym of symbols) {
      if (!ENRICHABLE_KINDS.has(sym.kind)) continue;
      await this.insertTask(sym.id, sym.name, sym.kind, sym.file_path, projectId);
      created++;
    }

    if (created > 0) {
      this.logger.info({ created, projectId }, '[enrichment] Batch tasks created for project');
    }
    return created;
  }

  /** Skip if symbol already enriched (BR-14). */
  private async shouldCreateTask(symbolId: number): Promise<boolean> {
    const row = await this.adapter.getAsync<{ enrichment_status: string | null }>(
      'SELECT enrichment_status FROM symbols WHERE id = ?',
      [symbolId],
    );
    // Skip if COMPLETED — allow re-enrichment for FAILED or NULL
    return row?.enrichment_status !== 'COMPLETED';
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
    const payload = JSON.stringify({
      symbolId, symbolName, symbolKind: kind,
      projectId, filePath, workspaceType: 'standard',
    });

    await this.adapter.runAsync(
      `INSERT INTO pending_tasks (task_type, entry_id, status, payload, max_retries, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [TaskType.CODE_ENRICHMENT, symbolId, TaskStatus.PENDING, payload, 3],
    );
  }
}
