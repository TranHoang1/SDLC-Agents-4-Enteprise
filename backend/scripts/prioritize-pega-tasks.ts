import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db' });
const res = await pool.query(
  `UPDATE pending_tasks SET created_at = '2020-01-01T00:00:00Z'
   WHERE task_type = 'CODE_ENRICHMENT' AND project_id = '3e268111b055' AND status = 'PENDING'`
);
console.log('Bumped', res.rowCount, 'Pega CODE_ENRICHMENT tasks to front of queue');
await pool.end();
process.exit(0);
