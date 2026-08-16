#!/usr/bin/env npx tsx
/**
 * SA4E-119 Database Migration Runner (SQLite)
 *
 * Runs 5 migrations for ECC Feature Parity epic against the local SQLite knowledge.db.
 * Uses better-sqlite3 for synchronous, transactional migration execution.
 *
 * Migrations:
 *   V119_01 — Add confidence fields to knowledge_entries
 *   V119_02 — Create instincts table
 *   V119_03 — Create gateguard_audit table
 *   V119_04 — Create skill_packs table
 *   V119_05 — Create pattern_extractions table
 *
 * Usage:
 *   npx tsx scripts/migrate-sa4e-119.ts [--dry-run] [--db path/to/knowledge.db]
 *
 * Exit codes:
 *   0 = success
 *   1 = migration failure
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { existsSync } from 'node:fs';

interface MigrationDef {
  name: string;
  description: string;
  sql: string;
}

/** SA4E-119 migrations — executed in order */
const MIGRATIONS: MigrationDef[] = [
  {
    name: 'V119_01__add_confidence_fields',
    description: 'Add corroboration/refresh fields to knowledge_entries',
    sql: `
      ALTER TABLE knowledge_entries ADD COLUMN corroboration_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE knowledge_entries ADD COLUMN last_refreshed_at TEXT;
      ALTER TABLE knowledge_entries ADD COLUMN confidence_source TEXT NOT NULL DEFAULT 'initial';
    `,
  },
  {
    name: 'V119_02__create_instincts',
    description: 'Create instincts table for project-scoped re-ranking rules',
    sql: `
      CREATE TABLE IF NOT EXISTS instincts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        rule_type TEXT NOT NULL CHECK(rule_type IN ('prefer_recent','prefer_verified','prefer_corroborated','custom')),
        weight REAL NOT NULL DEFAULT 1.0 CHECK(weight >= 0.1 AND weight <= 2.0),
        condition_json TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_instincts_project ON instincts(project_id, active);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_instincts_project_name ON instincts(project_id, name);
    `,
  },
  {
    name: 'V119_03__create_gateguard_audit',
    description: 'Create GateGuard audit log table',
    sql: `
      CREATE TABLE IF NOT EXISTS gateguard_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        command TEXT NOT NULL,
        agent TEXT,
        pattern_matched TEXT,
        action TEXT NOT NULL CHECK(action IN ('blocked','overridden','allowed')),
        override_by TEXT,
        project_id TEXT,
        context_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_gateguard_audit_time ON gateguard_audit(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_gateguard_audit_project ON gateguard_audit(project_id, timestamp DESC);
    `,
  },
  {
    name: 'V119_04__create_skill_packs',
    description: 'Create skill_packs registry table',
    sql: `
      CREATE TABLE IF NOT EXISTS skill_packs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        version TEXT NOT NULL,
        sa4e_compat TEXT NOT NULL DEFAULT '>=1.0.0',
        manifest_json TEXT NOT NULL,
        installed_at TEXT NOT NULL DEFAULT (datetime('now')),
        priority_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_skill_packs_active ON skill_packs(active, priority_order);
    `,
  },
  {
    name: 'V119_05__create_pattern_extractions',
    description: 'Create pattern extraction tracking table',
    sql: `
      CREATE TABLE IF NOT EXISTS pattern_extractions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_key TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        kb_entry_id INTEGER,
        reuse_count INTEGER NOT NULL DEFAULT 0,
        promoted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(kb_entry_id) REFERENCES knowledge_entries(id)
      );
      CREATE INDEX IF NOT EXISTS idx_pattern_ticket ON pattern_extractions(ticket_key);
      CREATE INDEX IF NOT EXISTS idx_pattern_reuse ON pattern_extractions(reuse_count DESC);
    `,
  },
];

/**
 * Ensure _migrations tracking table exists.
 * Matches pattern from existing run-migrations.ts (PostgreSQL) but adapted for SQLite.
 */
function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/** Get set of already-applied migration names */
function getAppliedMigrations(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT name FROM _migrations ORDER BY id').all() as { name: string }[];
  return new Set(rows.map(r => r.name));
}

/** Record a migration as applied */
function recordMigration(db: Database.Database, name: string): void {
  db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
}

/** Parse CLI arguments */
function parseArgs(): { dryRun: boolean; dbPath: string } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let dbPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--db' && args[i + 1]) {
      dbPath = args[++i];
    }
  }

  // Default: resolve knowledge.db from workspace root
  if (!dbPath) {
    const defaultPath = path.resolve(
      process.env.CODE_INTEL_WORKSPACE ?? process.cwd(),
      '.code-intel',
      'knowledge.db'
    );
    dbPath = defaultPath;
  }

  return { dryRun, dbPath };
}

function main(): void {
  const { dryRun, dbPath } = parseArgs();

  console.log(`SA4E-119 Migration Runner (SQLite)`);
  console.log(`Database: ${dbPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  if (!existsSync(dbPath)) {
    console.error(`ERROR: Database file not found: ${dbPath}`);
    console.error('Ensure .code-intel/knowledge.db exists or provide --db path');
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    ensureMigrationsTable(db);
    const applied = getAppliedMigrations(db);
    console.log(`Already applied: ${applied.size} migration(s)\n`);

    let newCount = 0;
    let skippedCount = 0;

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.name)) {
        console.log(`  SKIP: ${migration.name} (already applied)`);
        skippedCount++;
        continue;
      }

      if (dryRun) {
        console.log(`  WOULD RUN: ${migration.name} - ${migration.description}`);
        newCount++;
        continue;
      }

      console.log(`  Running: ${migration.name} - ${migration.description}`);

      // Execute each statement separately for SQLite ALTER TABLE compatibility
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const runMigration = db.transaction(() => {
        for (const stmt of statements) {
          db.exec(stmt);
        }
        recordMigration(db, migration.name);
      });

      try {
        runMigration();
        console.log(`  Done: ${migration.name}`);
        newCount++;
      } catch (err) {
        console.error(`  FAILED: ${migration.name}`);
        console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Result: ${newCount} new, ${skippedCount} skipped`);
    if (dryRun) {
      console.log('(Dry run - no changes applied)');
    }
  } finally {
    db.close();
  }
}

main();
