const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    // Find ALL integer columns without defaults (missing serial)
    const broken = await client.query(`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type = 'integer'
        AND column_name = 'id'
        AND (column_default IS NULL OR column_default = '')
      ORDER BY table_name
    `);
    
    console.log('Tables with id INTEGER but NO DEFAULT (broken serial):');
    for (const row of broken.rows) {
      console.log('  ' + row.table_name + '.id — default: ' + (row.column_default || 'NULL'));
    }

    // Fix each one
    for (const row of broken.rows) {
      const t = row.table_name;
      const seqName = t + '_id_seq';
      try {
        await client.query('CREATE SEQUENCE IF NOT EXISTS ' + seqName);
        await client.query('ALTER TABLE ' + t + ' ALTER COLUMN id SET DEFAULT nextval(\'' + seqName + '\')');
        await client.query('ALTER SEQUENCE ' + seqName + ' OWNED BY ' + t + '.id');
        console.log('  FIXED: ' + t + '.id → nextval(' + seqName + ')');
      } catch (e) {
        console.log('  SKIP ' + t + ': ' + e.message.split('\n')[0]);
      }
    }

    // Verify by checking counts
    console.log('\n--- Verification ---');
    const tables = ['knowledge_entries', 'symbols', 'files', 'pending_tasks', 'graph_nodes', 'body_embeddings'];
    for (const t of tables) {
      try {
        const def = await client.query(
          "SELECT column_default FROM information_schema.columns WHERE table_name = '" + t + "' AND column_name = 'id'"
        );
        const d = def.rows[0]?.column_default || 'NO DEFAULT (or no id col)';
        const cnt = await client.query('SELECT count(*) as c FROM ' + t);
        console.log(t + ': ' + cnt.rows[0].c + ' rows | id default: ' + d);
      } catch (e) { console.log(t + ': ' + e.message.split('\n')[0]); }
    }

  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error(e.message));
