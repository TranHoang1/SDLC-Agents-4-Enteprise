/**
 * MemoryEngine Crud Base — core CRUD + graph operations.
 * SA4E-53: converted to async API for PostgreSQL compatibility.
 */

import type { DatabaseAdapter } from '../../../database/adapters/DatabaseAdapter.js';
import { DialectHelper } from '../../../database/dialect/DialectHelper.js';
import type { KnowledgeEntry, GraphEdge } from '../models.js';
import { extractAndInsertIngestEdges } from './edge-on-ingest.js';

export class MemoryEngineCrud {
  protected readonly adapter: DatabaseAdapter;
  protected readonly dialect: DialectHelper;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
    this.dialect = new DialectHelper(adapter.getEngine());
  }

  /** @deprecated Use adapter directly. Removed in SA4E-47. */
  getDb(): unknown { return (this.adapter as any).db ?? this.adapter; }

  /** SA4E-53: Public accessor for async DB operations. */
  getAdapter(): DatabaseAdapter { return this.adapter; }

  /** SA4E-53: Public accessor for dialect helper. */
  getDialect(): DialectHelper { return this.dialect; }

  /** SA4E-47: Update structured_map JSON column for an entry. SA4E-53: async. */
  async updateStructuredMap(id: number, structuredMap: string): Promise<void> {
    await this.adapter.runAsync(
      `UPDATE knowledge_entries SET structured_map = ?, updated_at = ${this.dialect.now()} WHERE id = ?`,
      [structuredMap, id],
    );
  }

  async insert(entry: Partial<KnowledgeEntry> & { project_id?: string | null }): Promise<number> {
    const engine = this.adapter.getEngine();
    const params = [
      entry.content, entry.summary, entry.type,
      entry.tier ?? 'WORKING', entry.scope ?? 'USER',
      entry.user_id ?? null,
      entry.project_id ?? null,
      entry.source ?? null,
      entry.source_ref ?? null, entry.tags ?? '',
      entry.confidence ?? 1.0, entry.agent_name ?? null,
      entry.owner ?? null,
    ];
    let id: number;

    // SA4E-FIX: Use upsert when source is non-null to avoid duplicate key violation
    // on idx_ke_source_project_unique (source, project_id)
    const hasSource = entry.source != null && entry.source.length > 0;
    if (engine === 'postgresql') {
      if (hasSource) {
        const row = await this.adapter.getAsync<{ id: number }>(`
          INSERT INTO knowledge_entries
          (content, summary, type, tier, scope, user_id, project_id, source, source_ref, tags, confidence, agent_name, owner)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (source, project_id) WHERE source IS NOT NULL DO UPDATE SET
            content = EXCLUDED.content,
            summary = EXCLUDED.summary,
            type = EXCLUDED.type,
            tier = EXCLUDED.tier,
            scope = EXCLUDED.scope,
            tags = EXCLUDED.tags,
            confidence = EXCLUDED.confidence,
            agent_name = EXCLUDED.agent_name,
            owner = EXCLUDED.owner,
            updated_at = NOW()
          RETURNING id
        `, params);
        id = row?.id ?? 0;
      } else {
        const row = await this.adapter.getAsync<{ id: number }>(`
          INSERT INTO knowledge_entries
          (content, summary, type, tier, scope, user_id, project_id, source, source_ref, tags, confidence, agent_name, owner)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `, params);
        id = row?.id ?? 0;
      }
    } else {
      if (hasSource) {
        // SQLite: check-then-update/insert pattern for upsert
        const existing = await this.adapter.getAsync<{ id: number }>(
          `SELECT id FROM knowledge_entries WHERE source = ? AND project_id = ?`,
          [entry.source, entry.project_id ?? null],
        );
        if (existing) {
          await this.adapter.runAsync(`
            UPDATE knowledge_entries SET
              content = ?, summary = ?, type = ?, tier = ?, scope = ?,
              tags = ?, confidence = ?, agent_name = ?, owner = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [entry.content, entry.summary, entry.type, entry.tier ?? 'WORKING', entry.scope ?? 'USER',
              entry.tags ?? '', entry.confidence ?? 1.0, entry.agent_name ?? null, entry.owner ?? null,
              existing.id]);
          id = existing.id;
        } else {
          const result = await this.adapter.runAsync(`
            INSERT INTO knowledge_entries
            (content, summary, type, tier, scope, user_id, project_id, source, source_ref, tags, confidence, agent_name, owner)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, params);
          id = result.lastInsertRowid as number;
        }
      } else {
        const result = await this.adapter.runAsync(`
          INSERT INTO knowledge_entries
          (content, summary, type, tier, scope, user_id, project_id, source, source_ref, tags, confidence, agent_name, owner)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, params);
        id = result.lastInsertRowid as number;
      }
    }

    // Project eligible entries into graph_nodes for KB Graph visualization
    // Skip PEGA_RULE/PEGA_DATA (already projected by PegaService.ingestRule)
    // Skip PEGA_AST (auxiliary — duplicates PEGA_RULE in graph)
    if (id > 0 && entry.type && !['PEGA_RULE', 'PEGA_DATA', 'PEGA_AST'].includes(entry.type)) {
      try {
        const graphType = entry.type || 'CONTEXT';
        const graphLabel = (entry.summary || entry.source || `entry-${id}`).slice(0, 200);
        const pid = entry.project_id || '';
        if (engine === 'postgresql') {
          await this.adapter.runAsync(
            `INSERT INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (entry_id) DO NOTHING`,
            [`kb-entry:${id}`, graphLabel, graphType, entry.tier ?? 'WORKING', pid,
             Math.floor(Math.random() * 400) - 200, Math.floor(Math.random() * 400) - 200, 0, 2, null],
          );
        } else {
          await this.adapter.runAsync(
            `INSERT OR IGNORE INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`kb-entry:${id}`, graphLabel, graphType, entry.tier ?? 'WORKING', pid,
             Math.floor(Math.random() * 400) - 200, Math.floor(Math.random() * 400) - 200, 0, 2, null],
          );
        }
      } catch {
        // graph_nodes table may not exist in test environments — non-fatal
      }
    }

    // SA4E-91: Extract and insert edges for the new entry (non-blocking)
    if (id > 0 && entry.content) {
      try {
        await extractAndInsertIngestEdges(this.adapter, {
          entryId: `kb-entry:${id}`,
          content: entry.content,
          source: entry.source ?? null,
          tags: entry.tags ?? '',
          type: entry.type ?? '',
        });
      } catch {
        // Edge extraction is best-effort — never block ingest
      }
    }

    return id;
  }

  async syncExistingEntriesToGraph(): Promise<number> {
    const engine = this.adapter.getEngine();
    let entries;
    try {
      entries = await this.adapter.allAsync<{ id: number; type: string; summary: string; source: string; tier: string; project_id: string }>(
        `SELECT id, type, summary, source, tier, project_id FROM knowledge_entries
         WHERE type NOT IN ('PEGA_RULE', 'PEGA_DATA', 'PEGA_AST')
         AND id NOT IN (SELECT CAST(REPLACE(entry_id, 'kb-entry:', '') AS INTEGER) FROM graph_nodes WHERE entry_id LIKE 'kb-entry:%')`,
      );
    } catch {
      // graph_nodes table may not exist — non-fatal
      return 0;
    }
    let count = 0;
    for (const e of entries) {
      const graphType = e.type === 'PEGA_SCHEMA' ? 'PEGA_SCHEMA' : 'KNOWLEDGE_ENTRY';
      const label = (e.summary || e.source || `entry-${e.id}`).slice(0, 200);
      try {
        if (engine === 'postgresql') {
          await this.adapter.runAsync(
            `INSERT INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (entry_id) DO NOTHING`,
            [`kb-entry:${e.id}`, label, graphType, e.tier || 'WORKING', e.project_id || '',
             Math.floor(Math.random() * 400) - 200, Math.floor(Math.random() * 400) - 200, 0, 2, null],
          );
        } else {
          await this.adapter.runAsync(
            `INSERT OR IGNORE INTO graph_nodes (entry_id, label, type, tier, project_id, x, y, z, level, cluster_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`kb-entry:${e.id}`, label, graphType, e.tier || 'WORKING', e.project_id || '',
             Math.floor(Math.random() * 400) - 200, Math.floor(Math.random() * 400) - 200, 0, 2, null],
          );
        }
        count++;
      } catch {
        // graph_nodes table issue — skip
      }
    }
    return count;
  }

  async findById(id: number): Promise<KnowledgeEntry | undefined> {
    return this.adapter.getAsync<KnowledgeEntry>('SELECT * FROM knowledge_entries WHERE id = ?', [id]);
  }

  async deleteEntry(id: number): Promise<void> {
    await this.adapter.runAsync('DELETE FROM knowledge_entries WHERE id = ?', [id]);
  }

  async updateTags(id: number, tags: string): Promise<void> {
    await this.adapter.runAsync(
      `UPDATE knowledge_entries SET tags = ?, updated_at = ${this.dialect.now()} WHERE id = ?`,
      [tags, id],
    );
  }

  async recordAccess(id: number): Promise<void> {
    await this.adapter.runAsync(`
      UPDATE knowledge_entries
      SET access_count = access_count + 1, last_accessed_at = ${this.dialect.now()}
      WHERE id = ?
    `, [id]);
  }

  async addEdge(sourceId: number, targetId: number, relation = 'RELATES_TO', weight = 1.0): Promise<number> {
    const result = await this.adapter.runAsync(
      `INSERT INTO knowledge_graph_edges (source_id, target_id, relation, weight) VALUES (?, ?, ?, ?)`,
      [sourceId, targetId, relation, weight],
    );
    return result.lastInsertRowid as number;
  }

  async getNeighbors(nodeId: number): Promise<GraphEdge[]> {
    return this.adapter.allAsync<GraphEdge>(
      'SELECT * FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?',
      [nodeId, nodeId],
    );
  }

  async countEdges(): Promise<number> {
    const row = await this.adapter.getAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM knowledge_graph_edges');
    return row?.cnt ?? 0;
  }
}
