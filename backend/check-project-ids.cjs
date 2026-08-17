const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    // What project_ids exist in symbols?
    const symPids = await client.query("SELECT DISTINCT project_id, count(*) as cnt FROM symbols GROUP BY project_id");
    console.log('=== SYMBOLS project_ids ===');
    symPids.rows.forEach(r => console.log('  "' + r.project_id + '" → ' + r.cnt + ' symbols'));

    // What project_ids exist in files?
    const filePids = await client.query("SELECT DISTINCT project_id, count(*) as cnt FROM files GROUP BY project_id");
    console.log('\n=== FILES project_ids ===');
    filePids.rows.forEach(r => console.log('  "' + r.project_id + '" → ' + r.cnt + ' files'));

    // What project_ids exist in knowledge_entries?
    const kePids = await client.query("SELECT DISTINCT project_id, count(*) as cnt FROM knowledge_entries GROUP BY project_id");
    console.log('\n=== KNOWLEDGE_ENTRIES project_ids ===');
    kePids.rows.forEach(r => console.log('  "' + (r.project_id || 'NULL') + '" → ' + r.cnt + ' entries'));

    // What project_ids exist in graph_nodes?
    const gnPids = await client.query("SELECT DISTINCT project_id, count(*) as cnt FROM graph_nodes GROUP BY project_id");
    console.log('\n=== GRAPH_NODES project_ids ===');
    gnPids.rows.forEach(r => console.log('  "' + r.project_id + '" → ' + r.cnt + ' nodes'));
  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error(e.message));
