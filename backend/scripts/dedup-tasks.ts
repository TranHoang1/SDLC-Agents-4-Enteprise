import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://sa4e_user:sa4e_local_dev_password@localhost:5432/sa4e_db' });
async function main() {
  // 1. Delete duplicate PENDING TAG_ENRICHMENT (keep first per entry)
  const r1 = await pool.query(`
    DELETE FROM pending_tasks WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY entry_id, task_type ORDER BY id) as rn
        FROM pending_tasks WHERE task_type = 'TAG_ENRICHMENT' AND status = 'PENDING'
      ) sub WHERE rn > 1
    )
  `);
  console.log('Deduped pending TAG_ENRICHMENT:', r1.rowCount);

  // 2. Delete all COMPLETED TAG_ENRICHMENT tasks (no longer needed)
  const r2 = await pool.query(`DELETE FROM pending_tasks WHERE task_type = 'TAG_ENRICHMENT' AND status = 'COMPLETED'`);
  console.log('Purged completed TAG_ENRICHMENT:', r2.rowCount);

  // 3. Delete PENDING TAG_ENRICHMENT where entry already enriched
  const r3 = await pool.query(`
    DELETE FROM pending_tasks WHERE id IN (
      SELECT pt.id FROM pending_tasks pt
      JOIN knowledge_entries ke ON pt.entry_id = ke.id
      WHERE pt.task_type = 'TAG_ENRICHMENT' AND pt.status = 'PENDING' AND ke.enrichment_status = 'done'
    )
  `);
  console.log('Purged already-enriched:', r3.rowCount);

  // 4. Stats after cleanup
  const r4 = await pool.query(`SELECT task_type, status, COUNT(*) c FROM pending_tasks GROUP BY task_type, status ORDER BY task_type, status`);
  console.log('\nRemaining tasks:');
  r4.rows.forEach(r => console.log(' ', r.task_type, r.status, r.c));

  await pool.end();
}
main();
