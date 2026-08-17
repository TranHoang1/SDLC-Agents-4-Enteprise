/**
 * PostgreSQL Schema Fix — Align files/symbols/body_embeddings tables with engine/db/schema.ts
 * This script should be converted into a proper migration and run on startup.
 */
const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });

async function run() {
  const client = await pool.connect();
  try {
    console.log('=== PostgreSQL Schema Fix (engine/db/schema.ts alignment) ===\n');

    // Drop and recreate with EXACT schema from engine/db/schema.ts
    console.log('1. Dropping old tables...');
    await client.query('DROP TABLE IF EXISTS body_embeddings CASCADE');
    await client.query('DROP TABLE IF EXISTS symbols CASCADE');
    await client.query('DROP TABLE IF EXISTS files CASCADE');

    console.log('2. Creating files table (matching engine/db/schema.ts)...');
    await client.query(`CREATE TABLE files (
      id SERIAL PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT '',
      path TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT '',
      module TEXT,
      content_hash TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      last_indexed TEXT NOT NULL DEFAULT (NOW()::TEXT),
      line_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(project_id, path)
    )`);

    console.log('3. Creating symbols table...');
    await client.query(`CREATE TABLE symbols (
      id SERIAL PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT '',
      file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      signature TEXT,
      start_line INTEGER NOT NULL DEFAULT 0,
      end_line INTEGER NOT NULL DEFAULT 0,
      parent_symbol TEXT,
      visibility TEXT,
      doc_comment TEXT,
      is_exported INTEGER DEFAULT 0,
      complexity INTEGER DEFAULT 0
    )`);

    console.log('4. Creating body_embeddings table...');
    await client.query(`CREATE TABLE body_embeddings (
      id SERIAL PRIMARY KEY,
      symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      embedding BYTEA,
      token_count INTEGER DEFAULT 0
    )`);

    // Indexes
    console.log('5. Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_files_path ON files(relative_path)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_symbols_project ON symbols(project_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_body_symbol ON body_embeddings(symbol_id)');

    // Fix pending_tasks serial (if needed)
    console.log('6. Fixing pending_tasks.id serial...');
    const ptDef = await client.query("SELECT column_default FROM information_schema.columns WHERE table_name = 'pending_tasks' AND column_name = 'id'");
    if (!ptDef.rows[0]?.column_default) {
      await client.query("CREATE SEQUENCE IF NOT EXISTS pending_tasks_id_seq");
      await client.query("ALTER TABLE pending_tasks ALTER COLUMN id SET DEFAULT nextval('pending_tasks_id_seq')");
      await client.query("ALTER SEQUENCE pending_tasks_id_seq OWNED BY pending_tasks.id");
      console.log('   Fixed: pending_tasks.id now has serial');
    } else {
      console.log('   OK: already has serial');
    }

    // Fix knowledge_entries.vector column (if missing)
    console.log('7. Ensuring knowledge_entries.vector column...');
    try {
      await client.query("ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS vector BYTEA DEFAULT NULL");
      console.log('   OK');
    } catch (e) { console.log('   ' + e.message.split('\n')[0]); }

    // Clean failed tasks
    await client.query("DELETE FROM pending_tasks WHERE status = 'FAILED'");

    // Verification
    console.log('\n=== Verification ===');
    const testFile = await client.query(
      "INSERT INTO files (project_id, path, relative_path, language, content_hash, size_bytes) VALUES ('test', '/test.ts', 'test.ts', 'typescript', 'abc123', 100) RETURNING id"
    );
    console.log('files INSERT: OK (id=' + testFile.rows[0].id + ')');

    const testSym = await client.query(
      "INSERT INTO symbols (project_id, file_id, name, kind, start_line, end_line) VALUES ('test', " + testFile.rows[0].id + ", 'TestClass', 'class', 1, 10) RETURNING id"
    );
    console.log('symbols INSERT: OK (id=' + testSym.rows[0].id + ')');

    // Cleanup test data
    await client.query("DELETE FROM symbols WHERE name = 'TestClass'");
    await client.query("DELETE FROM files WHERE path = '/test.ts'");

    console.log('\n=== Done! Restart backend and re-index. ===');
  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error('FATAL:', e.message));
