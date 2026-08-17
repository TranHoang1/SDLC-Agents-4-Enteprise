import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db' });

// Check CODE_ENRICHMENT tasks for Pega project
const r1 = await pool.query(`
  SELECT status, COUNT(*) as cnt FROM pending_tasks
  WHERE task_type = 'CODE_ENRICHMENT' AND project_id = '3e268111b055'
  GROUP BY status
`);
console.log('CODE_ENRICHMENT tasks for Pega project (3e268111b055):');
console.table(r1.rows);

// Check if any CODE_ENRICHMENT tasks still have NULL project_id
const r2 = await pool.query(`
  SELECT COUNT(*) as cnt FROM pending_tasks
  WHERE task_type = 'CODE_ENRICHMENT' AND project_id IS NULL
`);
console.log('CODE_ENRICHMENT tasks with NULL project_id:', r2.rows[0].cnt);

// Check Pega symbols in symbols table
const r3 = await pool.query(`
  SELECT kind, enrichment_status, COUNT(*) as cnt
  FROM symbols WHERE project_id = '3e268111b055'
  GROUP BY kind, enrichment_status ORDER BY cnt DESC
`);
console.log('Pega symbols (project 3e268111b055):');
console.table(r3.rows);

await pool.end();
process.exit(0);
