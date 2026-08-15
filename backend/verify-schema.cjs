const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    console.log('=== FILES table columns ===');
    const f = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='files' ORDER BY ordinal_position");
    console.log(f.rows.map(r => r.column_name).join(', '));
    console.log('Total:', f.rows.length, 'columns');

    console.log('\n=== SYMBOLS table columns ===');
    const s = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='symbols' ORDER BY ordinal_position");
    console.log(s.rows.map(r => r.column_name).join(', '));
    console.log('Total:', s.rows.length, 'columns');

    console.log('\n=== Supporting tables ===');
    const tables = ['relationships', 'file_index', 'graph_meta', 'code_dependencies', 'code_call_graph', 'code_imports', 'modules', 'body_embeddings'];
    for (const t of tables) {
      const r = await client.query("SELECT count(*) as c FROM information_schema.columns WHERE table_name='" + t + "'");
      const exists = r.rows[0].c > 0 ? 'EXISTS (' + r.rows[0].c + ' cols)' : 'MISSING!';
      console.log('  ' + t + ': ' + exists);
    }

    console.log('\n=== Quick index test ===');
    const testResult = await client.query(
      "INSERT INTO files (project_id, path, relative_path, language, module, content_hash, size_bytes, line_count, file_created_at, file_author, file_version) VALUES ('test', '/verify.ts', 'verify.ts', 'typescript', 'test', 'hash', 100, 10, NULL, NULL, NULL) RETURNING id"
    );
    console.log('files INSERT OK: id=' + testResult.rows[0].id);
    await client.query("DELETE FROM files WHERE path = '/verify.ts'");
    console.log('Cleaned up. Schema is READY for indexing!');
  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error('ERROR:', e.message));
