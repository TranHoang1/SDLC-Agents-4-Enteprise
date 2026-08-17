const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    // Fix 1: Add missing 'hash' column to files table
    console.log('Adding hash column to files...');
    try {
      await client.query("ALTER TABLE files ADD COLUMN IF NOT EXISTS hash TEXT NOT NULL DEFAULT ''");
      console.log('  OK');
    } catch (e) { console.log('  ' + e.message.split('\n')[0]); }

    // Fix 2: Add missing 'vector' column to knowledge_entries
    console.log('Adding vector column to knowledge_entries...');
    try {
      await client.query("ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS vector BYTEA DEFAULT NULL");
      console.log('  OK');
    } catch (e) { console.log('  ' + e.message.split('\n')[0]); }

    // Fix 3: Add other commonly needed columns
    const fixes = [
      ["files", "last_modified", "TEXT DEFAULT NULL"],
      ["files", "line_count", "INTEGER DEFAULT 0"],
      ["symbols", "is_exported", "INTEGER DEFAULT 0"],
      ["symbols", "complexity", "INTEGER DEFAULT 0"],
    ];
    for (const [table, col, type] of fixes) {
      try {
        await client.query('ALTER TABLE ' + table + ' ADD COLUMN IF NOT EXISTS ' + col + ' ' + type);
        console.log('Added ' + table + '.' + col);
      } catch (e) { console.log(table + '.' + col + ': ' + e.message.split('\n')[0]); }
    }

    // Verify
    console.log('\nFiles table columns:');
    const fcols = await client.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='files' ORDER BY ordinal_position");
    fcols.rows.forEach(x => console.log('  ' + x.column_name + ' nullable:' + x.is_nullable + ' default:' + (x.column_default||'none')));

    // The 'path' column exists (NOT NULL) — backend uses it. 'relative_path' might be an alias or the actual used column
    // Let's just add path alias if missing
    try {
      await client.query("ALTER TABLE files ADD COLUMN IF NOT EXISTS path TEXT NOT NULL DEFAULT ''");
      console.log('Added files.path');
    } catch (e) { console.log('files.path: ' + e.message.split('\n')[0]); }

    console.log('\nTest INSERT into files (with path):');
    try {
      const r = await client.query("INSERT INTO files (path, relative_path, language, module, hash, project_id) VALUES ('src/test.ts', 'src/test.ts', 'typescript', 'test', 'hash123', 'test-proj') RETURNING id");
      console.log('  OK! id:', r.rows[0].id);
      await client.query("DELETE FROM files WHERE path = 'src/test.ts'");
    } catch (e) {
      console.log('  FAILED:', e.message);
    }

    // Clear failed tasks
    await client.query("DELETE FROM pending_tasks WHERE status = 'FAILED'");
    console.log('\nCleared failed pending_tasks');
    console.log('Done! Re-index workspace now.');
  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error(e.message));
