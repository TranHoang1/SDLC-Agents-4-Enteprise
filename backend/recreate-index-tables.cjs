const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    console.log('Dropping old tables...');
    await client.query('DROP TABLE IF EXISTS body_embeddings CASCADE');
    await client.query('DROP TABLE IF EXISTS symbols CASCADE');
    await client.query('DROP TABLE IF EXISTS files CASCADE');

    console.log('Creating files table (SQLite-compatible schema)...');
    await client.query(`CREATE TABLE files (
      id SERIAL PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT '',
      relative_path TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT '',
      module TEXT,
      hash TEXT NOT NULL DEFAULT '',
      last_modified TEXT,
      line_count INTEGER DEFAULT 0
    )`);

    console.log('Creating symbols table...');
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

    console.log('Creating body_embeddings table...');
    await client.query(`CREATE TABLE body_embeddings (
      id SERIAL PRIMARY KEY,
      symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      embedding BYTEA,
      token_count INTEGER DEFAULT 0
    )`);

    // Indexes
    await client.query('CREATE INDEX idx_files_project ON files(project_id)');
    await client.query('CREATE INDEX idx_files_path ON files(relative_path)');
    await client.query('CREATE INDEX idx_symbols_project ON symbols(project_id)');
    await client.query('CREATE INDEX idx_symbols_file ON symbols(file_id)');
    await client.query('CREATE INDEX idx_symbols_name ON symbols(name)');
    await client.query('CREATE INDEX idx_body_symbol ON body_embeddings(symbol_id)');
    console.log('Indexes created');

    // Test
    const r = await client.query("INSERT INTO files (relative_path, language, module, hash, project_id) VALUES ('test.ts', 'typescript', 'test', 'abc', 'proj') RETURNING id");
    console.log('Test insert OK! id:', r.rows[0].id);
    await client.query('DELETE FROM files WHERE id = ' + r.rows[0].id);

    console.log('\nDONE! Restart backend and re-index workspace.');
  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error(e.message));
