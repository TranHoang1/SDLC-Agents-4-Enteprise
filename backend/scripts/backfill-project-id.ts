import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db' });
const res = await pool.query(`
  UPDATE pending_tasks pt
  SET project_id = s.project_id
  FROM symbols s
  WHERE pt.entry_id = s.id
    AND pt.task_type = 'CODE_ENRICHMENT'
    AND pt.project_id IS NULL
`);
console.log('Backfilled project_id on', res.rowCount, 'pending CODE_ENRICHMENT tasks');
await pool.end();
process.exit(0);
