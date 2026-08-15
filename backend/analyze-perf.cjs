const { Pool } = require('pg');
const pool = new Pool({ host:'localhost', user:'sa4e_user', password:'sa4e_local_dev_password', database:'sa4e_db' });
async function run() {
  const client = await pool.connect();
  try {
    // 1. Pending tasks breakdown
    const taskStats = await client.query(`
      SELECT task_type, status, count(*) as cnt 
      FROM pending_tasks 
      GROUP BY task_type, status 
      ORDER BY task_type, status
    `);
    console.log('=== PENDING TASKS BREAKDOWN ===');
    taskStats.rows.forEach(r => console.log('  ' + r.task_type + ' | ' + r.status + ' | ' + r.cnt));

    // 2. Task completion rate (last 5 completed tasks timing)
    const recent = await client.query(`
      SELECT task_type, status, created_at, started_at, completed_at, error
      FROM pending_tasks 
      WHERE completed_at IS NOT NULL 
      ORDER BY completed_at DESC LIMIT 5
    `);
    console.log('\n=== LAST 5 COMPLETED TASKS ===');
    recent.rows.forEach(r => {
      const dur = r.started_at && r.completed_at ? 
        ((new Date(r.completed_at) - new Date(r.started_at))/1000).toFixed(1) + 's' : 'N/A';
      console.log('  ' + r.task_type + ' | ' + r.status + ' | duration: ' + dur + (r.error ? ' | ERR: ' + r.error.substring(0, 80) : ''));
    });

    // 3. Failed tasks
    const failed = await client.query(`
      SELECT task_type, error, count(*) as cnt 
      FROM pending_tasks 
      WHERE status = 'FAILED' 
      GROUP BY task_type, error 
      ORDER BY cnt DESC LIMIT 10
    `);
    console.log('\n=== FAILED TASKS (grouped by error) ===');
    if (failed.rows.length === 0) console.log('  None');
    failed.rows.forEach(r => console.log('  ' + r.task_type + ' (' + r.cnt + 'x): ' + (r.error || 'no error').substring(0, 100)));

    // 4. Queue depth and oldest pending
    const queue = await client.query(`
      SELECT count(*) as total, min(created_at) as oldest, max(created_at) as newest
      FROM pending_tasks WHERE status = 'PENDING'
    `);
    console.log('\n=== QUEUE STATUS ===');
    const q = queue.rows[0];
    console.log('  Pending: ' + q.total + ' tasks');
    console.log('  Oldest: ' + q.oldest);
    console.log('  Newest: ' + q.newest);

    // 5. Currently processing (IN_PROGRESS)
    const inprog = await client.query(`
      SELECT task_type, started_at, entry_id 
      FROM pending_tasks WHERE status = 'IN_PROGRESS'
    `);
    console.log('\n=== IN PROGRESS ===');
    if (inprog.rows.length === 0) console.log('  None (worker idle or between tasks)');
    inprog.rows.forEach(r => console.log('  ' + r.task_type + ' | started: ' + r.started_at + ' | entry: ' + r.entry_id));

    // 6. DB table sizes for context
    const sizes = await client.query(`
      SELECT 'files' as t, count(*) as c FROM files
      UNION ALL SELECT 'symbols', count(*) FROM symbols
      UNION ALL SELECT 'knowledge_entries', count(*) FROM knowledge_entries
      UNION ALL SELECT 'graph_nodes', count(*) FROM graph_nodes
      UNION ALL SELECT 'body_embeddings', count(*) FROM body_embeddings
    `);
    console.log('\n=== TABLE COUNTS ===');
    sizes.rows.forEach(r => console.log('  ' + r.t + ': ' + r.c));

  } finally { client.release(); await pool.end(); }
}
run().catch(e => console.error(e.message));
