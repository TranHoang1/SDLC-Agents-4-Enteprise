/**
 * KSA-168: Git Miner — Semantic search over git commit history.
 * Parses git log, stores commit metadata, enables text-based search.
 */

import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import type { GitCommit, GitCommitResult, GitIndexSummary } from './types.js';

export class GitMiner {
  private db: Database.Database;
  private repoPath: string;
  private maxCommits: number;

  constructor(db: Database.Database, repoPath: string, maxCommits: number = 10000) {
    this.db = db;
    this.repoPath = repoPath;
    this.maxCommits = maxCommits;
    this.ensureSchema();
  }

  /** Index git commits (incremental by default). */
  indexHistory(force: boolean = false): GitIndexSummary {
    const lastHash = force ? null : this.getLastIndexedHash();
    const commits = this.parseGitLog(lastHash);

    if (commits.length === 0) {
      return this.getSummary();
    }

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO git_commits (hash, author, date, message, files_changed, insertions, deletions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: GitCommit[]) => {
      for (const commit of items) {
        insert.run(
          commit.hash,
          commit.author,
          commit.date,
          commit.message,
          JSON.stringify(commit.filesChanged),
          commit.insertions,
          commit.deletions
        );
      }
    });
    transaction(commits);

    // Update metadata
    if (commits.length > 0) {
      this.db.prepare(
        `INSERT OR REPLACE INTO git_index_meta (key, value) VALUES ('last_indexed_hash', ?)`
      ).run(commits[0].hash);
      this.db.prepare(
        `INSERT OR REPLACE INTO git_index_meta (key, value) VALUES ('last_indexed_at', datetime('now'))`
      ).run();
    }

    return this.getSummary();
  }

  /** Search commits by text query (FTS on message + files). */
  search(query: string, options: { author?: string; file?: string; limit?: number; since?: string } = {}): GitCommitResult[] {
    const limit = options.limit ?? 10;
    let sql = `SELECT hash, author, date, message, files_changed, insertions, deletions FROM git_commits WHERE 1=1`;
    const params: unknown[] = [];

    if (query) {
      sql += ` AND (message LIKE ? OR files_changed LIKE ?)`;
      params.push(`%${query}%`, `%${query}%`);
    }
    if (options.author) {
      sql += ` AND author LIKE ?`;
      params.push(`%${options.author}%`);
    }
    if (options.file) {
      sql += ` AND files_changed LIKE ?`;
      params.push(`%${options.file}%`);
    }
    if (options.since) {
      sql += ` AND date >= ?`;
      params.push(options.since);
    }

    sql += ` ORDER BY date DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Array<{
      hash: string; author: string; date: string; message: string;
      files_changed: string; insertions: number; deletions: number;
    }>;

    return rows.map((row, idx) => ({
      hash: row.hash,
      author: row.author,
      date: row.date,
      message: row.message,
      filesChanged: JSON.parse(row.files_changed),
      insertions: row.insertions,
      deletions: row.deletions,
      score: 1.0 - (idx * 0.05), // Simple rank-based score
    }));
  }

  /** Get indexing summary. */
  getSummary(): GitIndexSummary {
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM git_commits').get() as { count: number };
    const lastHashRow = this.db.prepare(
      `SELECT value FROM git_index_meta WHERE key = 'last_indexed_hash'`
    ).get() as { value: string } | undefined;
    const lastTimeRow = this.db.prepare(
      `SELECT value FROM git_index_meta WHERE key = 'last_indexed_at'`
    ).get() as { value: string } | undefined;

    return {
      totalCommits: countRow.count,
      indexed: countRow.count,
      lastHash: lastHashRow?.value ?? null,
      lastIndexedAt: lastTimeRow?.value ?? null,
    };
  }

  private parseGitLog(sinceHash: string | null): GitCommit[] {
    try {
      let cmd = `git log --format="%H|%an|%aI|%s" --numstat`;
      if (sinceHash) {
        cmd += ` ${sinceHash}..HEAD`;
      } else {
        cmd += ` -n ${this.maxCommits}`;
      }

      const output = execSync(cmd, {
        cwd: this.repoPath,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 30000,
      });

      return this.parseLogOutput(output);
    } catch (err) {
      console.error('[git-miner] Failed to parse git log:', err);
      return [];
    }
  }

  private parseLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const lines = output.split('\n');
    let current: GitCommit | null = null;

    for (const line of lines) {
      if (!line.trim()) {
        if (current) {
          commits.push(current);
          current = null;
        }
        continue;
      }

      // Header line: hash|author|date|message
      const headerMatch = line.match(/^([0-9a-f]{40})\|(.+?)\|(.+?)\|(.+)$/);
      if (headerMatch) {
        if (current) commits.push(current);
        current = {
          hash: headerMatch[1],
          author: headerMatch[2],
          date: headerMatch[3],
          message: headerMatch[4],
          filesChanged: [],
          insertions: 0,
          deletions: 0,
        };
        continue;
      }

      // Numstat line: insertions\tdeletions\tfilename
      if (current) {
        const statMatch = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
        if (statMatch) {
          const ins = statMatch[1] === '-' ? 0 : parseInt(statMatch[1], 10);
          const del = statMatch[2] === '-' ? 0 : parseInt(statMatch[2], 10);
          current.insertions += ins;
          current.deletions += del;
          current.filesChanged.push(statMatch[3]);
        }
      }
    }

    if (current) commits.push(current);
    return commits;
  }

  private getLastIndexedHash(): string | null {
    try {
      const row = this.db.prepare(
        `SELECT value FROM git_index_meta WHERE key = 'last_indexed_hash'`
      ).get() as { value: string } | undefined;
      return row?.value ?? null;
    } catch {
      return null;
    }
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS git_commits (
        hash TEXT PRIMARY KEY,
        author TEXT NOT NULL,
        date TEXT NOT NULL,
        message TEXT NOT NULL,
        files_changed TEXT NOT NULL DEFAULT '[]',
        insertions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_git_date ON git_commits(date);
      CREATE INDEX IF NOT EXISTS idx_git_author ON git_commits(author);

      CREATE TABLE IF NOT EXISTS git_index_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
}
