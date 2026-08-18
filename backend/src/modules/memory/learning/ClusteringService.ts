/**
 * SA4E-122: ClusteringService — clusters related instincts into
 * skills/procedures over time. Groups instincts by tag similarity
 * and co-occurrence, then creates PROCEDURE entries for clusters
 * that exceed a size threshold.
 */

import type { MemoryEngine } from '../engine/core.js';
import type { ScopeContext, KnowledgeEntry } from '../models.js';

/** Minimum instincts in a cluster before procedure creation. */
const MIN_CLUSTER_SIZE = 3;

/** Result of a clustering run. */
export interface ClusterResult {
  /** Number of clusters found. */
  clustersFound: number;
  /** Number of new procedures created. */
  proceduresCreated: number;
  /** Cluster summaries for reporting. */
  clusters: ClusterSummary[];
}

/** Summary of a single cluster. */
export interface ClusterSummary {
  /** Common tags in this cluster. */
  commonTags: string[];
  /** Number of instincts in cluster. */
  size: number;
  /** Whether a procedure was created for this cluster. */
  procedureCreated: boolean;
  /** Entry ID of created procedure (if any). */
  procedureId?: number;
}

export class ClusteringService {
  private readonly engine: MemoryEngine;

  constructor(engine: MemoryEngine) {
    this.engine = engine;
  }

  /**
   * Run clustering on all auto-learned instincts.
   * Groups by tag similarity, creates procedures for large clusters.
   * @param scopeCtx Scope context for isolation
   * @returns Clustering results summary
   */
  async cluster(scopeCtx?: ScopeContext): Promise<ClusterResult> {
    const instincts = await this.fetchAutoLearnedInstincts(scopeCtx);
    if (instincts.length < MIN_CLUSTER_SIZE) {
      return { clustersFound: 0, proceduresCreated: 0, clusters: [] };
    }

    const groups = this.groupByTagSimilarity(instincts);
    const clusters: ClusterSummary[] = [];
    let proceduresCreated = 0;

    for (const [tags, entries] of groups) {
      if (entries.length < MIN_CLUSTER_SIZE) continue;

      const commonTags = tags.split(',');
      const alreadyExists = await this.procedureExists(commonTags);

      if (alreadyExists) {
        clusters.push({ commonTags, size: entries.length, procedureCreated: false });
        continue;
      }

      const procId = await this.createProcedureFromCluster(commonTags, entries, scopeCtx);
      proceduresCreated++;
      clusters.push({ commonTags, size: entries.length, procedureCreated: true, procedureId: procId });
    }

    return { clustersFound: groups.size, proceduresCreated, clusters };
  }

  /** Fetch all instincts with 'auto-learned' tag. */
  private async fetchAutoLearnedInstincts(_scopeCtx?: ScopeContext): Promise<KnowledgeEntry[]> {
    const adapter = this.engine.getAdapter();
    const rows = await adapter.allAsync<KnowledgeEntry>(
      `SELECT * FROM knowledge_entries
       WHERE type = 'INSTINCT' AND tags LIKE '%auto-learned%' AND archived = 0
       ORDER BY created_at DESC LIMIT 200`,
    );
    return rows;
  }

  /** Group instincts by common tags (excluding 'instinct' and 'auto-learned'). */
  private groupByTagSimilarity(entries: KnowledgeEntry[]): Map<string, KnowledgeEntry[]> {
    const groups = new Map<string, KnowledgeEntry[]>();

    for (const entry of entries) {
      const tags = this.getSignificantTags(entry.tags);
      const key = tags.sort().join(',');
      if (!key) continue;

      const group = groups.get(key) || [];
      group.push(entry);
      groups.set(key, group);
    }

    return groups;
  }

  /** Filter out generic tags, keep meaningful ones. */
  private getSignificantTags(tagStr: string): string[] {
    const ignore = new Set(['instinct', 'auto-learned', 'error-fix', 'correction']);
    return tagStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t && !ignore.has(t));
  }

  /** Check if a procedure already exists for this tag set. */
  private async procedureExists(tags: string[]): Promise<boolean> {
    const adapter = this.engine.getAdapter();
    const tagPattern = tags[0] || 'auto-cluster';
    const row = await adapter.getAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM knowledge_entries
       WHERE type = 'PROCEDURE' AND tags LIKE ? AND archived = 0`,
      [`%${tagPattern}%`],
    );
    return (row?.cnt ?? 0) > 0;
  }

  /** Create a PROCEDURE entry summarizing the cluster. */
  private async createProcedureFromCluster(
    commonTags: string[],
    entries: KnowledgeEntry[],
    scopeCtx?: ScopeContext,
  ): Promise<number> {
    const name = `Cluster: ${commonTags.join(', ')}`;
    const content = this.buildProcedureContent(name, entries);
    const tags = ['procedure', 'auto-cluster', ...commonTags].join(',');

    return this.engine.insert({
      content,
      summary: `[Procedure] ${name}`,
      type: 'PROCEDURE',
      tier: 'SEMANTIC',
      scope: 'PROJECT',
      source: 'auto-learn/cluster',
      tags,
      user_id: scopeCtx?.userId ?? null,
      project_id: scopeCtx?.projectId ?? null,
      agent_name: 'auto-learner',
    });
  }

  /** Build procedure content from cluster entries. */
  private buildProcedureContent(name: string, entries: KnowledgeEntry[]): string {
    const steps = entries
      .slice(0, 10)
      .map((e, i) => `${i + 1}. ${e.content.slice(0, 150)}`)
      .join('\n');
    return `Procedure: ${name}\n\nAuto-clustered from ${entries.length} related instincts:\n\n${steps}`;
  }
}
