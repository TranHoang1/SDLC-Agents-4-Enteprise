/**
 * SA4E-6 follow-up — fix pending_tasks schema drift (PostgreSQL).
 *
 * Root cause: the running code-intel server (Kiro) references the `pending_tasks.priority`
 * column, but the actual PostgreSQL table was created by the runtime migration
 * `src/modules/memory/migrations/003-pending-tasks.ts`, which does NOT include `priority`
 * (or `error_message`, `updated_at`, `claimed_at`, `dead_lettered_at`, `payload JSONB`).
 * This drift makes `mem_ingest` / `mem_ingest_file` fail with:
 *   column "priority" of relation "pending_tasks" does not exist
 *
 * This script aligns the live DB with scripts/run-migrations.ts schema (idempotent).
 * Run against the same PostgreSQL instance used by the backend (adjust conn below).
 */
const { Pool } = require('pg');
// Matches backend/.env.dev & .env.example:
//   DATABASE_URL=postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db',
});

const ALTERS = [
  ['pending_tasks', 'priority', 'INTEGER NOT NULL DEFAULT 0'],
  ['pending_tasks', 'error_message', 'TEXT DEFAULT NULL'],
  ['pending_tasks', 'updated_at', 'TIMESTAMPTZ DEFAULT NOW()'],
  ['pending_tasks', 'claimed_at', 'TIMESTAMPTZ DEFAULT NULL'],
  ['pending_tasks', 'completed_at', 'TIMESTAMPTZ DEFAULT NULL'],
  ['pending_tasks', 'dead_lettered_at', 'TIMESTAMPTZ DEFAULT NULL'],
];

async function run() {
  const client = await pool.connect();
  try {
    console.log('=== Fix pending_tasks schema drift (SA4E-6) ===\n');

    for (const [table, col, type] of ALTERS) {
      try {
        await client.query(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`
        );
        console.log(`  OK   ${table}.${col} (${type})`);
      } catch (e) {
        console.log(`  SKIP ${table}.${col}: ${e.message.split('\n')[0]}`);
      }
    }

    console.log('\n2. Ensure priority index...');
    try {
      await client.query(
        'CREATE INDEX IF NOT EXISTS idx_pending_tasks_priority ON pending_tasks(priority)'
      );
      console.log('  OK');
    } catch (e) {
      console.log('  SKIP:', e.message.split('\n')[0]);
    }

    console.log('\n=== Verify pending_tasks columns ===');
    const cols = await client.query(
      "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='pending_tasks' ORDER BY ordinal_position"
    );
    cols.rows.forEach((r) =>
      console.log(`  ${r.column_name} ${r.data_type}${r.column_default ? ' default=' + r.column_default : ''}`)
    );

    console.log('\n=== Done. Restart code-intel backend and retry mem_ingest. ===');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => console.error('FATAL:', e.message));