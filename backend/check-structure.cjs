const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    // Check if there are any errors logged
    const ops = await client.query("SELECT * FROM pending_tasks WHERE status != 'COMPLETED' LIMIT 5");
    console.log('pending_tasks non-completed:', ops.rows.length);
    ops.rows.forEach(t => console.log('  id:' + t.id + ' type:' + t.task_type + ' status:' + t.status + ' error:' + (t.error||'none')));

    // Test INSERT into files table
    console.log('\nTest INSERT into files:');
    try {
      const r = await client.query("INSERT INTO files (relative_path, language, module, hash, project_id) VALUES ('test.ts', 'typescript', 'test', 'abc123', 'test-proj') RETURNING id");
      console.log('  OK! id:', r.rows[0].id);
      await client.query("DELETE FROM files WHERE relative_path = 'test.ts'");
    } catch (e) {
      console.log('  FAILED:', e.message);
    }

    // Test INSERT into symbols table
    console.log('\nTest INSERT into symbols:');
    try {
      // Need a file first
      const f = await client.query("INSERT INTO files (relative_path, language, module, hash, project_id) VALUES ('test2.ts', 'typescript', 'test', 'xyz', 'test-proj') RETURNING id");
      const fid = f.rows[0].id;
      const s = await client.query("INSERT INTO symbols (project_id, file_id, name, kind, signature, start_line, end_line) VALUES ('test-proj', " + fid + ", 'TestClass', 'class', 'class TestClass', 1, 10) RETURNING id");
      console.log('  OK! symbol id:', s.rows[0].id);
      await client.query("DELETE FROM symbols WHERE name = 'TestClass'");
      await client.query("DELETE FROM files WHERE relative_path = 'test2.ts'");
    } catch (e) {
      console.log('  FAILED:', e.message);
    }

    // Check what counts look like now
    const counts = ['files', 'symbols', 'knowledge_entries', 'graph_nodes'];
    for (const t of counts) {
      const r = await client.query('SELECT count(*) as c FROM ' + t);
      console.log(t + ':', r.rows[0].c);
    }
  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error(e.message));
