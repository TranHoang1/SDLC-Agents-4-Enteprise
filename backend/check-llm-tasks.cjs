const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    // CODE_SUMMARY tasks
    const cs = await client.query("SELECT status, count(*) as cnt FROM pending_tasks WHERE task_type='CODE_SUMMARY' GROUP BY status");
    console.log('=== CODE_SUMMARY tasks ===');
    if (cs.rows.length === 0) console.log('  NONE QUEUED — code symbols NOT being sent to LLM');
    cs.rows.forEach(r => console.log('  ' + r.status + ': ' + r.cnt));

    // All tasks by type
    const all = await client.query('SELECT task_type, status, count(*) as cnt FROM pending_tasks GROUP BY task_type, status ORDER BY task_type, status');
    console.log('\n=== ALL TASKS ===');
    all.rows.forEach(r => console.log('  ' + r.task_type + ' | ' + r.status + ' | ' + r.cnt));

    // body_embeddings (GraphSyncService reads this to queue CODE_SUMMARY)
    const be = await client.query('SELECT count(*) as c FROM body_embeddings');
    console.log('\n=== body_embeddings: ' + be.rows[0].c + ' rows ===');
    if (parseInt(be.rows[0].c) === 0) {
      console.log('  ROOT CAUSE: body_embeddings is EMPTY');
      console.log('  GraphSyncService.queueCodeSummaryTasks() needs body_embeddings data');
      console.log('  No body stored → no CODE_SUMMARY tasks → LLM not called for code symbols');
    }
  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error(e.message));
